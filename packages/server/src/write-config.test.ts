import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import {
    SockethubConfigSchemaId,
    validateSockethubConfig,
} from "@sockethub/schemas";

import { Config } from "./config.js";
import {
    enableWebPush,
    parseWebPushSubject,
    parseWriteConfigTarget,
    renderDefaultConfig,
    WRITE_WEBPUSH_CONFIG_FLAG,
    writeDefaultConfig,
    writeWebPushConfig,
} from "./write-config.js";

describe("write-config", () => {
    const tmpFiles: Array<string> = [];

    function tmpTarget(): string {
        const file = path.join(
            os.tmpdir(),
            `sh-write-config-${tmpFiles.length}-${process.pid}.json`,
        );
        tmpFiles.push(file);
        return file;
    }

    afterEach(() => {
        for (const file of tmpFiles.splice(0)) {
            fs.rmSync(file, { force: true });
        }
    });

    describe("parseWriteConfigTarget", () => {
        it("returns undefined when the flag is absent", () => {
            expect(parseWriteConfigTarget(["--port", "1234"])).toBeUndefined();
        });

        it("defaults to sockethub.config.json with no value", () => {
            expect(parseWriteConfigTarget(["--write-config"])).toEqual(
                "sockethub.config.json",
            );
        });

        it("accepts a separate path argument", () => {
            expect(
                parseWriteConfigTarget(["--write-config", "my.json"]),
            ).toEqual("my.json");
        });

        it("accepts --write-config=path", () => {
            expect(parseWriteConfigTarget(["--write-config=my.json"])).toEqual(
                "my.json",
            );
        });

        it("treats '-' as stdout", () => {
            expect(parseWriteConfigTarget(["--write-config", "-"])).toEqual(
                "-",
            );
        });

        it("does not consume a following flag as the path", () => {
            expect(
                parseWriteConfigTarget(["--write-config", "--examples"]),
            ).toEqual("sockethub.config.json");
        });
    });

    describe("renderDefaultConfig", () => {
        it("emits valid JSON that validates against the schema", () => {
            const parsed = JSON.parse(renderDefaultConfig());
            expect(validateSockethubConfig(parsed)).toEqual("");
        });

        it("stamps the versioned $schema reference", () => {
            const parsed = JSON.parse(renderDefaultConfig());
            expect(parsed.$schema).toEqual(SockethubConfigSchemaId);
            expect(parsed.$schema).not.toContain("/v/");
        });

        it("includes the full default tree", () => {
            const parsed = JSON.parse(renderDefaultConfig());
            expect(parsed.sockethub.port).toBe(10550);
            expect(parsed.platforms).toContain("@sockethub/platform-feeds");
            // The test platform is not part of a generated deployment config.
            expect(parsed.platforms).not.toContain("@sockethub/platform-dummy");
            expect(parsed.httpActions.enabled).toBe(false);
            expect(parsed.redis.maxRetriesPerRequest).toBeNull();
        });
    });

    describe("writeDefaultConfig", () => {
        it("prints to stdout and writes no file for '-'", () => {
            let written = "";
            const spy = spyOn(process.stdout, "write").mockImplementation(
                (chunk: string | Uint8Array) => {
                    written += chunk.toString();
                    return true;
                },
            );
            try {
                const message = writeDefaultConfig("-");
                expect(message).toEqual("");
            } finally {
                spy.mockRestore();
            }
            // Round-trips: stdout carries the full valid config, not a path.
            expect(validateSockethubConfig(JSON.parse(written))).toEqual("");
        });

        it("writes the file and reports the resolved path", () => {
            const target = tmpTarget();
            const message = writeDefaultConfig(target);
            expect(message).toContain(path.resolve(target));
            const parsed = JSON.parse(fs.readFileSync(target, "utf-8"));
            expect(validateSockethubConfig(parsed)).toEqual("");
        });

        it("refuses to overwrite an existing file", () => {
            const target = tmpTarget();
            fs.writeFileSync(target, "{}");
            expect(() => writeDefaultConfig(target)).toThrow(
                /refusing to overwrite/,
            );
            expect(fs.readFileSync(target, "utf-8")).toEqual("{}");
        });
    });
});

describe("write-config with Web Push enabled", () => {
    const WEBPUSH = "@sockethub/platform-webpush";
    const SUBJECT = "mailto:ops@example.org";
    const tmpFiles: Array<string> = [];

    function tmpTarget(contents?: unknown): string {
        const file = path.join(
            os.tmpdir(),
            `sh-write-webpush-${tmpFiles.length}-${process.pid}.json`,
        );
        tmpFiles.push(file);
        if (contents !== undefined) {
            fs.writeFileSync(file, JSON.stringify(contents));
        }
        return file;
    }
    const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));

    afterEach(() => {
        for (const file of tmpFiles.splice(0)) {
            fs.rmSync(file, { force: true });
        }
    });

    it("reads its own target and the contact from argv", () => {
        const argv = [WRITE_WEBPUSH_CONFIG_FLAG, "--webpush-subject", SUBJECT];
        expect(parseWriteConfigTarget(argv)).toBeUndefined();
        expect(parseWriteConfigTarget(argv, WRITE_WEBPUSH_CONFIG_FLAG)).toBe(
            "sockethub.config.json",
        );
        expect(parseWebPushSubject(argv)).toBe(SUBJECT);
        expect(parseWebPushSubject([`--webpush-subject=${SUBJECT}`])).toBe(
            SUBJECT,
        );
        expect(
            parseWriteConfigTarget(
                [`${WRITE_WEBPUSH_CONFIG_FLAG}=a.json`],
                WRITE_WEBPUSH_CONFIG_FLAG,
            ),
        ).toBe("a.json");
    });

    it("writes a new config that the server loads with Web Push on", () => {
        const target = tmpTarget();
        const message = writeWebPushConfig(target, SUBJECT);
        expect(message).toContain(`wrote ${target}`);
        expect(message).toContain("Redis persistence");
        expect(fs.statSync(target).mode & 0o777).toBe(0o600);

        const written = read(target);
        expect(validateSockethubConfig(written)).toEqual("");
        expect(written.platforms).toContain(WEBPUSH);
        expect(written.platforms).toContain("@sockethub/platform-feeds");
        const { vapid, scheduledDelivery } = written.packageConfig[WEBPUSH];
        expect(vapid.subject).toBe(SUBJECT);
        expect(scheduledDelivery).toEqual({
            secret: expect.stringMatching(/^.{32,}$/),
            maxMessagesPerSubscription: 60,
            maxSubscriptions: 10000,
            maxDaysAhead: 60,
            maxSchedulesPerMinute: 30,
        });

        // The pair is a real one: the private key signs, the public verifies.
        const point = Buffer.from(vapid.publicKey, "base64url");
        const jwk = {
            kty: "EC",
            crv: "P-256",
            x: point.subarray(1, 33).toString("base64url"),
            y: point.subarray(33).toString("base64url"),
        };
        const signature = crypto.sign(
            "sha256",
            Buffer.from("x"),
            crypto.createPrivateKey({
                key: { ...jwk, d: vapid.privateKey },
                format: "jwk",
            }),
        );
        expect(
            crypto.verify(
                "sha256",
                Buffer.from("x"),
                crypto.createPublicKey({ key: jwk, format: "jwk" }),
                signature,
            ),
        ).toBeTrue();

        const argv = process.argv;
        process.argv = ["node", "test", "--config", target];
        try {
            expect(new Config().get("platforms")).toContain(WEBPUSH);
        } finally {
            process.argv = argv;
        }
    });

    it("adds what an existing config is missing and keeps the rest", () => {
        const target = tmpTarget({
            platforms: ["@sockethub/platform-xmpp"],
            redis: { url: "redis://example.org:6379" },
            packageConfig: {
                "@sockethub/platform-feeds": { connectTimeoutMs: 7000 },
            },
        });
        fs.chmodSync(target, 0o640);
        expect(writeWebPushConfig(target, SUBJECT)).toContain(
            `updated ${target}, adding the platform, a key pair, a scheduled delivery secret`,
        );
        const written = read(target);
        expect(written.platforms).toEqual(["@sockethub/platform-xmpp", WEBPUSH]);
        expect(written.redis).toEqual({ url: "redis://example.org:6379" });
        expect(written.packageConfig["@sockethub/platform-feeds"]).toEqual({
            connectTimeoutMs: 7000,
        });
        expect(written.packageConfig[WEBPUSH].vapid.subject).toBe(SUBJECT);
        expect(fs.statSync(target).mode & 0o777).toBe(0o640);

        // A second run finds nothing to add and leaves the file alone.
        const before = fs.readFileSync(target, "utf8");
        expect(writeWebPushConfig(target)).toContain("nothing changed");
        expect(fs.readFileSync(target, "utf8")).toBe(before);
    });

    it("never replaces a key pair or secret that is already there", () => {
        const vapid = {
            publicKey: "B".repeat(87),
            privateKey: "a".repeat(43),
            subject: "mailto:first@example.org",
        };
        const target = tmpTarget({
            platforms: [WEBPUSH],
            packageConfig: {
                [WEBPUSH]: { vapid, scheduledDelivery: { maxDaysAhead: 14 } },
            },
        });
        // No contact is needed when no key pair has to be made.
        expect(writeWebPushConfig(target)).toContain(
            "adding a scheduled delivery secret",
        );
        const entry = read(target).packageConfig[WEBPUSH];
        expect(entry.vapid).toEqual(vapid);
        expect(entry.scheduledDelivery.maxDaysAhead).toBe(14);
        const { secret } = entry.scheduledDelivery;

        writeWebPushConfig(target, SUBJECT);
        expect(read(target).packageConfig[WEBPUSH].scheduledDelivery.secret).toBe(
            secret,
        );
    });

    it("leaves scheduled delivery off where the file turns it off", () => {
        const config: Record<string, unknown> = {
            packageConfig: { [WEBPUSH]: { scheduledDelivery: { secret: "" } } },
        };
        expect(enableWebPush(config, SUBJECT)).toEqual([
            "the platform",
            "a key pair",
        ]);
        expect(
            (config.packageConfig as Record<string, Record<string, unknown>>)[
                WEBPUSH
            ].scheduledDelivery,
        ).toEqual({ secret: "" });
    });

    it("keeps the default platforms of a file that names none", () => {
        const config: Record<string, unknown> = {};
        enableWebPush(config, SUBJECT);
        expect(config.platforms).toContain("@sockethub/platform-feeds");
        expect(config.platforms).toContain(WEBPUSH);
    });

    it("needs a contact to make a key pair, and writes nothing without one", () => {
        const target = tmpTarget();
        expect(() => writeWebPushConfig(target)).toThrow(/--webpush-subject/);
        expect(() => writeWebPushConfig(target, "ops@example.org")).toThrow(
            /--webpush-subject/,
        );
        expect(fs.existsSync(target)).toBeFalse();
    });

    it("refuses a file it cannot safely change", () => {
        const broken = tmpTarget();
        fs.writeFileSync(broken, "{ not json");
        expect(() => writeWebPushConfig(broken, SUBJECT)).toThrow(/cannot read/);
        expect(fs.readFileSync(broken, "utf8")).toBe("{ not json");

        const odd = tmpTarget({ packageConfig: [] });
        expect(() => writeWebPushConfig(odd, SUBJECT)).toThrow(
            /`packageConfig` must be an object/,
        );
    });

    it("prints a new config to stdout for '-'", () => {
        const stdout = spyOn(process.stdout, "write").mockImplementation(
            () => true,
        );
        try {
            expect(writeWebPushConfig("-", SUBJECT)).toBe("");
            const printed = JSON.parse(String(stdout.mock.calls[0][0]));
            expect(validateSockethubConfig(printed)).toEqual("");
            expect(printed.platforms).toContain(WEBPUSH);
        } finally {
            stdout.mockRestore();
        }
    });
});
