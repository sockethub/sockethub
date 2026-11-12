import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { isExpectedError } from "@sockethub/util/error";
import {
    MAX_DOWNLOAD_BYTES,
    readCapped,
    resolveDownloadConfig,
    sniffImageType,
    TooLargeError,
} from "./download";
import Image from "./index";

const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
]);
const bytes = (text: string) => new TextEncoder().encode(text);

describe("sniffImageType", () => {
    it("identifies each supported type from its leading bytes", () => {
        expect(sniffImageType(PNG)).toBe("png");
        expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
            "jpeg",
        );
        expect(sniffImageType(bytes("GIF89a\x01\x00"))).toBe("gif");
        expect(sniffImageType(bytes("RIFF\x00\x00\x00\x00WEBPVP8 "))).toBe(
            "webp",
        );
        expect(
            sniffImageType(bytes("\x00\x00\x00\x1cftypmif1\x00\x00\x00\x00avif")),
        ).toBe("avif");
        expect(sniffImageType(new Uint8Array([0, 0, 1, 0, 1, 0]))).toBe("ico");
        expect(
            sniffImageType(
                bytes(
                    '﻿<?xml version="1.0"?>\n<!-- icon -->\n<svg xmlns="http://www.w3.org/2000/svg"/>',
                ),
            ),
        ).toBe("svg");
    });

    it("finds an svg root after a doctype, and gives up fast on junk prologues", () => {
        expect(
            sniffImageType(
                bytes(
                    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd">\n<!-- a --><!-- b -->\n<svg>',
                ),
            ),
        ).toBe("svg");
        const start = performance.now();
        expect(sniffImageType(bytes(" <!--".repeat(1000)))).toBeUndefined();
        expect(sniffImageType(bytes("<!---->".repeat(600)))).toBeUndefined();
        expect(performance.now() - start).toBeLessThan(100);
    });

    it("rejects pages and other files, whatever they are labelled", () => {
        expect(sniffImageType(bytes("<!doctype html><html>"))).toBeUndefined();
        expect(sniffImageType(bytes("%PDF-1.7"))).toBeUndefined();
        expect(
            sniffImageType(bytes("\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00")),
        ).toBeUndefined();
        expect(sniffImageType(new Uint8Array(0))).toBeUndefined();
    });
});

describe("resolveDownloadConfig", () => {
    it("allows every type with a 10 MiB cap and 12 s by default", () => {
        const config = resolveDownloadConfig(undefined);
        expect(config.maxBytes).toBe(10 * 1024 * 1024);
        expect(config.timeoutMs).toBe(12_000);
        expect([...config.types].sort()).toEqual([
            "avif",
            "gif",
            "ico",
            "jpeg",
            "png",
            "svg",
            "webp",
        ]);
    });

    it("applies operator overrides and clamps maxBytes to the guard's cap", () => {
        const config = resolveDownloadConfig({
            maxBytes: 50 * 1024 * 1024,
            types: ["png", "jpeg"],
        });
        expect(config.maxBytes).toBe(MAX_DOWNLOAD_BYTES);
        expect([...config.types].sort()).toEqual(["jpeg", "png"]);
    });
});

describe("readCapped", () => {
    it("stops reading once the body passes the limit", async () => {
        let pulls = 0;
        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                pulls++;
                controller.enqueue(new Uint8Array(1024));
            },
        });
        expect(readCapped(body, 4096)).rejects.toBeInstanceOf(TooLargeError);
        await new Promise((r) => setTimeout(r, 10));
        expect(pulls).toBeLessThan(10);
    });
});

type Handler = (
    path: string,
    headers: Record<string, string | string[] | undefined>,
) => { status?: number; headers?: Record<string, string>; body?: Uint8Array };

describe("image download", () => {
    let server: Server;
    let base: string;
    let handler: Handler = () => ({ body: PNG });
    let lastHeaders: Record<string, string | string[] | undefined> = {};

    beforeAll(async () => {
        server = createServer((req, res) => {
            lastHeaders = req.headers;
            const reply = handler(req.url || "/", req.headers);
            res.writeHead(reply.status ?? 200, reply.headers);
            res.end(reply.body ? Buffer.from(reply.body) : undefined);
        });
        await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(() => {
        server.close();
    });

    function download(
        url: string,
        config: Record<string, unknown> = {},
        page = `${base}/article`,
    ): Promise<{ err: Error | undefined; result: unknown }> {
        // biome-ignore lint/suspicious/noExplicitAny: minimal fake session
        const platform = new Image({ log: { debug() {} } } as any);
        Object.assign(platform.config, { allowPrivateAddresses: true }, config);
        const job = {
            "@context": ["x"],
            type: "download",
            actor: { id: page, type: "website" },
            object: { type: "image", url },
        };
        return new Promise((resolve) => {
            // biome-ignore lint/suspicious/noExplicitAny: test job
            platform.download(job as any, (err, result) =>
                resolve({ err: err as Error | undefined, result }),
            );
        });
    }

    it("returns the bytes, sniffed type and final URL", async () => {
        handler = (path) =>
            path === "/old.png"
                ? { status: 302, headers: { location: "/new.png" } }
                : {
                      headers: { "content-type": "application/octet-stream" },
                      body: PNG,
                  };
        const { err, result } = await download(`${base}/old.png`);
        expect(err).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object).toEqual({
            type: "image",
            url: `${base}/new.png`,
            mediaType: "image/png",
            size: PNG.byteLength,
            data: Buffer.from(PNG).toString("base64"),
        });
    });

    it("resolves a relative URL against the page and sends its origin as Referer", async () => {
        handler = () => ({ body: new Uint8Array([0, 0, 1, 0, 1, 0]) });
        const { err, result } = await download("/favicon.ico");
        expect(err).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.url).toBe(`${base}/favicon.ico`);
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.mediaType).toBe("image/x-icon");
        expect(lastHeaders.referer).toBe(`${base}/`);
        expect(lastHeaders.accept).toContain("image/png");
    });

    it("refuses an image type the operator has not allowed", async () => {
        handler = () => ({ body: bytes("<svg></svg>") });
        const { err } = await download(`${base}/a.svg`, {
            types: ["png"],
        });
        expect(err?.message).toContain("(not-image)");
        expect(err?.message).toContain("svg images are not allowed");
    });

    it("refuses a page served in place of an image", async () => {
        handler = () => ({
            headers: { "content-type": "text/html; charset=utf-8" },
            body: bytes("<html>captcha</html>"),
        });
        const { err } = await download(`${base}/a.png`);
        expect(err?.message).toContain("(not-image)");
        expect(err?.message).toContain("served as text/html");
        expect(isExpectedError(err)).toBe(true);
    });

    it("refuses an image over maxBytes, declared or streamed", async () => {
        const big = new Uint8Array(4096);
        big.set(PNG);
        handler = () => ({
            headers: { "content-length": String(big.byteLength) },
            body: big,
        });
        const declared = await download(`${base}/big.png`, {
            maxBytes: 1024,
        });
        expect(declared.err?.message).toContain("(too-large)");
        expect(declared.err?.message).toContain("image is 4096 bytes");

        handler = () => ({
            headers: { "transfer-encoding": "chunked" },
            body: big,
        });
        const streamed = await download(`${base}/big.png`, {
            maxBytes: 1024,
        });
        expect(streamed.err?.message).toContain("(too-large)");
    });

    it("names refusals, missing images and other HTTP failures", async () => {
        for (const [status, code] of [
            [403, "origin-refused"],
            [429, "origin-refused"],
            [404, "not-found"],
            [500, "origin-error"],
        ] as const) {
            handler = () => ({ status });
            const { err } = await download(`${base}/a.png`);
            expect(err?.message).toBe(
                `image download failed (${code}) for ${base}/a.png: HTTP ${status}`,
            );
        }
    });

    it("times out even when the request ignores its abort signal", async () => {
        for (const stalled of [
            // No response at all.
            () => new Promise(() => {}),
            // Headers, then a body that never ends.
            () =>
                Promise.resolve(
                    new Response(
                        new ReadableStream({
                            start(controller) {
                                controller.enqueue(PNG);
                            },
                        }),
                    ),
                ),
        ]) {
            // biome-ignore lint/suspicious/noExplicitAny: minimal fake session
            const platform = new Image({ log: { debug() {} } } as any);
            // biome-ignore lint/suspicious/noExplicitAny: test-only overrides
            Object.assign(platform as any, { fetchImpl: stalled });
            Object.assign(platform.config, { timeoutMs: 50 });
            const err = await new Promise<Error | undefined>((resolve) => {
                platform.download(
                    {
                        "@context": ["x"],
                        type: "download",
                        actor: { id: "https://example.com/", type: "website" },
                        object: { type: "image", url: "/a.png" },
                        // biome-ignore lint/suspicious/noExplicitAny: test job
                    } as any,
                    (e) => resolve(e as Error | undefined),
                );
            });
            expect(err?.message).toContain("(timeout)");
            expect(isExpectedError(err)).toBe(true);
        }
    });

    it("refuses non-http URLs", async () => {
        const { err } = await download("data:image/png;base64,AAAA");
        expect(err?.message).toContain("(invalid-url)");
    });
});
