import { createServer } from "node:http";
import Metadata from "../index";

function fetchMetadata(platform: Metadata, url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(
            () => reject(new Error("metadata callback timed out")),
            2_000,
        );
        platform.fetch(
            {
                "@context": ["test"],
                type: "fetch",
                actor: { id: url, type: "website" },
            } as never,
            (err, result) => {
                clearTimeout(timeout);
                if (err) reject(err);
                else resolve(result);
            },
        );
    });
}

let requestCount = 0;
const server = createServer((_req, res) => {
    requestCount++;
    if (requestCount === 1) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("controlled failure");
        return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
        '<html><head><meta property="og:title" content="Repeated"></head></html>',
    );
});

let listening = false;
for (let offset = 0; offset < 20 && !listening; offset++) {
    const port = 42_000 + (process.pid % 1_000) + offset;
    try {
        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(port, "127.0.0.1", () => {
                server.off("error", reject);
                resolve();
            });
        });
        listening = true;
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
    }
}
if (!listening) throw new Error("could not bind local test server");

const address = server.address();
if (!address || typeof address === "string") {
    throw new Error("test server did not bind a TCP port");
}

// biome-ignore lint/suspicious/noExplicitAny: minimal platform session
const platform = new Metadata({ log: { debug() {} } } as any);
platform.config.allowPrivateAddresses = true;
const url = `http://127.0.0.1:${address.port}/post`;

try {
    try {
        await fetchMetadata(platform, url);
        throw new Error("controlled fetch unexpectedly succeeded");
    } catch (err) {
        if (!String(err).includes("500 Internal Server Error")) throw err;
    }
    const first = await fetchMetadata(platform, url);
    const second = await fetchMetadata(platform, url);
    // biome-ignore lint/suspicious/noExplicitAny: platform callback shape
    if ((first as any).object.title !== "Repeated") {
        throw new Error("first fetch returned unexpected metadata");
    }
    // biome-ignore lint/suspicious/noExplicitAny: platform callback shape
    if ((second as any).object.title !== "Repeated") {
        throw new Error("second fetch returned unexpected metadata");
    }
    console.log("failure recovery and sequential fetches completed");
} finally {
    await new Promise<void>((resolve) => platform.cleanup(() => resolve()));
    await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
    );
}
