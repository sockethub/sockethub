/**
 * End-to-end HTTP actions coverage, including hostile input handling.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { createConnection } from "node:net";
import { join } from "node:path";
import config from "./config.js";

const socketUrl = config.sockethub.url;
const httpPath = "/sockethub/http";
const httpUrl = `${socketUrl}${httpPath}`;
const requireHttpActions = process.env.REQUIRE_HTTP_ACTIONS === "true";

let sockethubProcess: ChildProcess | undefined;
let usingExternalSockethub = false;
let httpActionsAvailable = false;
let managedSockethub = false;

async function isPortOpen(host: string, port: number) {
    return new Promise<boolean>((resolve) => {
        const socket = createConnection({ host, port });
        const done = (result: boolean) => {
            socket.removeAllListeners();
            socket.end();
            socket.destroy();
            resolve(result);
        };
        socket.once("connect", () => done(true));
        socket.once("error", () => done(false));
        socket.setTimeout(1000, () => done(false));
    });
}

async function stopSockethubProcess(process: ChildProcess) {
    const waitForExit = (signal: NodeJS.Signals, timeoutMs: number) =>
        new Promise<boolean>((resolve) => {
            if (process.exitCode !== null || process.signalCode !== null) {
                resolve(true);
                return;
            }

            const onExit = () => {
                clearTimeout(timeoutId);
                resolve(true);
            };

            const timeoutId = setTimeout(() => {
                process.off("exit", onExit);
                resolve(false);
            }, timeoutMs);

            process.once("exit", onExit);
            process.kill(signal);
        });

    const exitedAfterTerm = await waitForExit("SIGTERM", 3000);
    if (exitedAfterTerm) {
        return;
    }

    await waitForExit("SIGKILL", 1000);
}

async function waitForHttpActions(timeoutMs: number) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(httpUrl, { method: "GET" });
            if (res.status !== 404) {
                return true;
            }
        } catch {
            // Retry until timeout
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return false;
}

function buildEchoPayload(content: string) {
    return {
        type: "echo",
        context: "dummy",
        actor: { id: "test@dummy", type: "person" },
        object: { type: "message", content },
    };
}

function parseNdjson(text: string) {
    return text
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

describe("HTTP actions integration", () => {
    beforeAll(async () => {
        const port = Number.parseInt(config.sockethub.port, 10);
        usingExternalSockethub = await isPortOpen("localhost", port);

        if (!usingExternalSockethub) {
            const sockethubPath = join(
                process.cwd(),
                "packages/sockethub/bin/sockethub",
            );

            sockethubProcess = spawn("bun", ["run", sockethubPath], {
                env: {
                    ...process.env,
                    REDIS_URL: config.redis.url,
                    PORT: config.sockethub.port,
                    NODE_ENV: "test",
                    SOCKETHUB_HTTP_ACTIONS_ENABLED: "true",
                    SOCKETHUB_HTTP_ACTIONS_REQUIRE_REQUEST_ID: "true",
                    SOCKETHUB_HTTP_ACTIONS_MAX_MESSAGES_PER_REQUEST: "3",
                    SOCKETHUB_HTTP_ACTIONS_MAX_PAYLOAD_BYTES: "2048",
                    SOCKETHUB_HTTP_ACTIONS_IDEMPOTENCY_TTL_MS: "5000",
                    SOCKETHUB_HTTP_ACTIONS_REQUEST_TIMEOUT_MS: "4000",
                    SOCKETHUB_HTTP_ACTIONS_IDLE_TIMEOUT_MS: "2000",
                },
                stdio: ["pipe", "pipe", "pipe"],
            });

            await new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(
                        new Error(
                            "Sockethub server failed to start within timeout",
                        ),
                    );
                }, 15000);

                let serverStarted = false;

                sockethubProcess?.stdout?.on("data", (data) => {
                    const output = data.toString();
                    if (
                        output.includes(
                            `sockethub listening on ws://localhost:${config.sockethub.port}`,
                        ) &&
                        !serverStarted
                    ) {
                        serverStarted = true;
                        clearTimeout(timeoutId);
                        resolve();
                    }
                });

                sockethubProcess?.on("error", (err) => {
                    clearTimeout(timeoutId);
                    reject(err);
                });

                sockethubProcess?.on("exit", (code, signal) => {
                    if (!serverStarted) {
                        clearTimeout(timeoutId);
                        reject(
                            new Error(
                                `Sockethub process exited with code ${code} and signal ${signal} before startup completed`,
                            ),
                        );
                    }
                });
            });
            managedSockethub = true;
        }

        httpActionsAvailable = await waitForHttpActions(5000);
        if (requireHttpActions && !httpActionsAvailable) {
            throw new Error(
                "HTTP actions endpoint is not available but REQUIRE_HTTP_ACTIONS=true",
            );
        }
    });

    afterAll(async () => {
        if (sockethubProcess && !sockethubProcess.killed) {
            await stopSockethubProcess(sockethubProcess);
            sockethubProcess = undefined;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    });

    it("streams a valid dummy echo response", async () => {
        if (!httpActionsAvailable) {
            return;
        }

        const requestId = `req-${Date.now()}`;
        const payload = buildEchoPayload("integration");
        const res = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": requestId,
            },
            body: JSON.stringify(payload),
        });

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain(
            "application/x-ndjson",
        );
        expect(res.headers.get("x-request-id")).toBe(requestId);

        const lines = parseNdjson(await res.text());
        expect(lines.length).toBe(1);
        expect(lines[0].actor.id).toBe("dummy");
        expect(lines[0].type).toBe("echo");
    });

    it("replays cached results on POST with the same request id", async () => {
        if (!httpActionsAvailable) {
            return;
        }

        const requestId = `req-${Date.now()}-replay`;
        const payload = buildEchoPayload("replay");

        const first = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": requestId,
            },
            body: JSON.stringify(payload),
        });
        expect(first.status).toBe(200);
        await first.text();

        const second = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": requestId,
            },
            body: JSON.stringify(payload),
        });
        expect(second.status).toBe(200);
        expect(second.headers.get("x-idempotent-replay")).toBe("true");
    });

    it("serves cached results via GET", async () => {
        if (!httpActionsAvailable) {
            return;
        }

        const requestId = `req-${Date.now()}-get`;
        const payload = buildEchoPayload("get-replay");

        const post = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": requestId,
            },
            body: JSON.stringify(payload),
        });
        expect(post.status).toBe(200);
        await post.text();

        const getRes = await fetch(`${httpUrl}/${requestId}`, {
            method: "GET",
        });
        expect(getRes.status).toBe(200);
        expect(getRes.headers.get("x-idempotent-replay")).toBe("true");
        const lines = parseNdjson(await getRes.text());
        expect(lines.length).toBe(1);
    });

    it("rejects missing request ids", async () => {
        if (!httpActionsAvailable) {
            return;
        }

        const res = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(buildEchoPayload("missing-request-id")),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("requestId is required");
    });

    it("rejects oversized message batches", async () => {
        if (!httpActionsAvailable) {
            return;
        }
        if (!managedSockethub) {
            return;
        }

        const payloads = [
            buildEchoPayload("one"),
            buildEchoPayload("two"),
            buildEchoPayload("three"),
            buildEchoPayload("four"),
        ];

        const res = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": `req-${Date.now()}-too-many`,
            },
            body: JSON.stringify(payloads),
        });

        expect(res.status).toBe(413);
    });

    it("rejects invalid JSON payloads", async () => {
        if (!httpActionsAvailable) {
            return;
        }

        const res = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": `req-${Date.now()}-invalid-json`,
            },
            body: "{this-is-not-json",
        });

        expect(res.status).toBe(400);
    });

    it("rejects non-object JSON bodies", async () => {
        if (!httpActionsAvailable) {
            return;
        }

        const res = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": `req-${Date.now()}-string-body`,
            },
            body: JSON.stringify("not-an-object"),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain("request body must be a payload object");
    });

    it("returns error payloads for malformed ActivityStreams", async () => {
        if (!httpActionsAvailable) {
            return;
        }

        const res = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": `req-${Date.now()}-malformed`,
            },
            body: JSON.stringify({
                type: "echo",
                context: "dummy",
                object: { type: "message", content: "missing actor" },
            }),
        });

        expect(res.status).toBe(200);
        const lines = parseNdjson(await res.text());
        expect(lines.length).toBe(1);
        expect(typeof lines[0].error).toBe("string");
    });

    it("handles garbage payloads without crashing", async () => {
        if (!httpActionsAvailable) {
            return;
        }

        const res = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": `req-${Date.now()}-garbage`,
            },
            body: JSON.stringify([null, 42, "nope"]),
        });

        expect(res.status).toBe(200);
        const lines = parseNdjson(await res.text());
        expect(lines.length).toBe(3);
        for (const line of lines) {
            expect(typeof line.error).toBe("string");
        }
    });

    it("rejects payloads that exceed the configured byte limit", async () => {
        if (!httpActionsAvailable) {
            return;
        }
        if (!managedSockethub) {
            return;
        }

        const bigContent = "x".repeat(4096);
        const res = await fetch(httpUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": `req-${Date.now()}-too-big`,
            },
            body: JSON.stringify(buildEchoPayload(bigContent)),
        });

        expect(res.status).toBe(413);
    });
});
