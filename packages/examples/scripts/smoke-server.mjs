#!/usr/bin/env bun
/**
 * Starts Redis and Sockethub with --examples for Playwright smoke tests.
 * Assumes the monorepo has already been built.
 */
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../..",
);
const healthUrl = "http://localhost:10550/";
const feedFixtureUrl = "http://localhost:10551/feed.xml";
const feedFixturePath = path.join(root, "packages/examples/static/feed.xml");

/** Poll an HTTP URL until it returns a successful response. */
async function waitForHttp(url, maxAttempts = 90) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {
            // Server not ready yet.
        }

        if (attempt === maxAttempts) {
            throw new Error(
                `Timed out waiting for ${url} after ${maxAttempts}s`,
            );
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}

/** Send SIGTERM to a child process when still running. */
function shutdown(child) {
    if (child && !child.killed) {
        child.kill("SIGTERM");
    }
}

/** Stop the feed fixture server and Sockethub child process. */
function shutdownAll(sockethub, feedFixture) {
    feedFixture.close();
    shutdown(sockethub);
}

try {
    execSync("nc -z 127.0.0.1 6379", { stdio: "ignore" });
    console.log("Redis already listening on 6379");
} catch {
    console.log("Starting Redis for examples smoke tests...");
    execSync("docker compose up redis -d", { cwd: root, stdio: "inherit" });
    execSync(
        "bash -c 'for i in $(seq 1 30); do nc -z 127.0.0.1 6379 && exit 0; sleep 1; done; exit 1'",
        {
            stdio: "inherit",
        },
    );
}

const feedFixture = createServer((req, res) => {
    if (req.url === "/feed.xml") {
        res.writeHead(200, { "Content-Type": "application/rss+xml" });
        res.end(readFileSync(feedFixturePath));
        return;
    }

    res.writeHead(404);
    res.end();
});
feedFixture.listen(10551, "localhost");
console.log(`Feed fixture served at ${feedFixtureUrl}`);

console.log("Starting Sockethub with examples...");
const sockethub = spawn(
    "bun",
    ["packages/sockethub/bin/sockethub", "--examples"],
    {
        cwd: root,
        stdio: "inherit",
        env: {
            ...process.env,
            REDIS_URL: "redis://127.0.0.1:6379",
            PORT: "10550",
            // The smoke test serves its feed fixture from loopback, which
            // the feeds SSRF guard blocks by default. Dev/test only.
            SOCKETHUB_FEEDS_ALLOW_PRIVATE_ADDRESSES: "true",
        },
    },
);

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => {
        shutdownAll(sockethub, feedFixture);
        process.exit(0);
    });
}

sockethub.on("exit", (code, sig) => {
    feedFixture.close();
    if (sig) {
        process.exit(0);
    }
    process.exit(code ?? 1);
});

try {
    await waitForHttp(healthUrl);
    console.log(`Sockethub examples smoke server ready on ${healthUrl}`);
} catch (error) {
    console.error(error.message);
    shutdownAll(sockethub, feedFixture);
    process.exit(1);
}
