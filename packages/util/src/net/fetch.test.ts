import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { safeFetch } from "./fetch.js";

// The fetch/dispatcher path runs on Node (the Bun runner ignores undici
// dispatchers), so it is validated in integration and in the subprocess
// test below. Here we cover the pre-connect validation gate, which is pure
// and deterministic.

describe("safeFetch validation gate", () => {
    it("rejects an unsupported scheme before connecting", async () => {
        await expect(safeFetch("ftp://example.com/x")).rejects.toThrow(
            /unsupported scheme/,
        );
    });

    it("rejects a malformed URL before connecting", async () => {
        await expect(safeFetch("not a url")).rejects.toThrow(/invalid URL/);
    });
});

describe("safeFetch through the guarded dispatcher on Node", () => {
    // Regression for sockethub/sockethub#1293: passing our undici Agent to a
    // global `fetch` from a different undici major (Node 26 ships undici 8)
    // returned responses with no headers at all. safeFetch must use undici's
    // own fetch so headers survive on every supported Node release.
    it("returns the response headers", async () => {
        const moduleUrl = pathToFileURL(
            join(import.meta.dir, "../../dist/net/index.js"),
        ).href;
        const script = `
            import { createServer } from "node:http";
            import { safeFetch } from ${JSON.stringify(moduleUrl)};
            const server = createServer((req, res) => {
                res.setHeader("content-type", "text/plain; charset=utf-8");
                res.setHeader("x-sockethub-test", "present");
                res.end("ok");
            });
            await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
            try {
                const url = "http://127.0.0.1:" + server.address().port + "/";
                const res = await safeFetch(url, { allowPrivateAddresses: true });
                const body = await res.text();
                const keys = [...res.headers.keys()];
                if (
                    res.status !== 200 ||
                    body !== "ok" ||
                    res.headers.get("x-sockethub-test") !== "present" ||
                    !res.headers.get("content-type")?.startsWith("text/plain")
                ) {
                    console.error(JSON.stringify({ status: res.status, body, keys }));
                    process.exitCode = 1;
                }
            } finally {
                server.close();
            }
        `;
        const process = Bun.spawn(
            ["node", "--input-type=module", "--eval", script],
            { stdout: "pipe", stderr: "pipe" },
        );
        const [exitCode, stdout, stderr] = await Promise.all([
            process.exited,
            new Response(process.stdout).text(),
            new Response(process.stderr).text(),
        ]);

        expect(`${stdout}${stderr}`).toBe("");
        expect(exitCode).toBe(0);
    });
});
