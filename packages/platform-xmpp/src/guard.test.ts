import { describe, expect, it } from "bun:test";
import type { SrvRecord } from "node:dns";
import { createServer } from "node:net";
import { client as xmppClient, type XmppClientInstance } from "@xmpp/client";

import { discoverServices, guardXmppConnections } from "./guard.js";

const srv = (name: string, port: number, priority = 0, weight = 0): SrvRecord => ({
    name,
    port,
    priority,
    weight,
});

const resolverFor =
    (records: Record<string, SrvRecord[]>) =>
    async (name: string): Promise<SrvRecord[]> => {
        const found = records[name];
        if (!found) {
            throw Object.assign(new Error("queryNoData"), { code: "ENODATA" });
        }
        return found;
    };

describe("discoverServices", () => {
    it("passes explicit service URIs through untouched", async () => {
        const resolve = async () => {
            throw new Error("must not be called");
        };
        expect(await discoverServices("xmpp://chat.example.org:5222", resolve)).toEqual([
            "xmpp://chat.example.org:5222",
        ]);
    });

    it("falls back to xmpp://host:5222 without SRV records", async () => {
        expect(await discoverServices("example.org", resolverFor({}))).toEqual(["xmpp://example.org:5222"]);
    });

    it("orders every SRV record across xmpps and xmpp", async () => {
        const resolve = resolverFor({
            "_xmpps-client._tcp.example.org": [srv("tls.example.org", 5223, 10)],
            "_xmpp-client._tcp.example.org": [
                srv("low.example.org", 5222, 5, 1),
                srv("high.example.org", 5222, 5, 50),
            ],
        });
        expect(await discoverServices("example.org", resolve)).toEqual([
            "xmpp://high.example.org:5222",
            "xmpp://low.example.org:5222",
            "xmpps://tls.example.org:5223",
        ]);
    });

    it("uses direct TLS first when the xmpps record wins", async () => {
        const resolve = resolverFor({
            "_xmpps-client._tcp.example.org": [srv("tls.example.org", 5223, 0)],
            "_xmpp-client._tcp.example.org": [srv("plain.example.org", 5222, 10)],
        });
        expect(await discoverServices("example.org", resolve)).toEqual([
            "xmpps://tls.example.org:5223",
            "xmpp://plain.example.org:5222",
        ]);
    });

    it("rejects a '.' target, which marks the service unavailable", async () => {
        const resolve = resolverFor({
            "_xmpp-client._tcp.example.org": [srv(".", 0)],
        });
        await expect(discoverServices("example.org", resolve)).rejects.toThrow(
            "XMPP service is not available at example.org",
        );
    });

    it("still uses the other scheme when only one is marked unavailable", async () => {
        const resolve = resolverFor({
            "_xmpps-client._tcp.example.org": [srv(".", 0)],
            "_xmpp-client._tcp.example.org": [srv("plain.example.org", 5222)],
        });
        expect(await discoverServices("example.org", resolve)).toEqual(["xmpp://plain.example.org:5222"]);
    });
});

describe("guardXmppConnections", () => {
    const makeClient = () => {
        class Tcp {
            socketParameters(service: string) {
                const { hostname, port, protocol } = new URL(service);
                return protocol === "xmpp:" ? { host: hostname, port: Number(port) } : undefined;
            }
        }
        class Ws {
            socketParameters(service: string) {
                return service.startsWith("ws") ? service : undefined;
            }
        }
        return {
            client: { transports: [Tcp, Ws] } as unknown as XmppClientInstance,
            Tcp,
            Ws,
        };
    };

    it("refuses blocked IP literals", () => {
        const { client, Tcp } = makeClient();
        guardXmppConnections(client, false);
        for (const host of ["127.0.0.1", "10.0.0.5", "169.254.169.254", "[::1]", "[fe80::1]"]) {
            expect(() => Tcp.prototype.socketParameters(`xmpp://${host}:5222`)).toThrow(
                "blocked non-public address",
            );
        }
    });

    it("allows public IP literals and strips IPv6 brackets", () => {
        const { client, Tcp } = makeClient();
        guardXmppConnections(client, false);
        expect(Tcp.prototype.socketParameters("xmpp://8.8.8.8:5222")).toEqual({
            host: "8.8.8.8",
            port: 5222,
        });
        expect(Tcp.prototype.socketParameters("xmpp://[2606:4700:4700::1111]:5222")).toEqual({
            host: "2606:4700:4700::1111",
            port: 5222,
        });
    });

    it("attaches a guarded DNS lookup for host names", async () => {
        const { client, Tcp } = makeClient();
        guardXmppConnections(client, false);
        const params = Tcp.prototype.socketParameters("xmpp://localhost:5222") as {
            lookup: (h: string, o: object, cb: (err: Error | null) => void) => void;
        };
        const err = await new Promise<Error | null>((resolve) =>
            params.lookup("localhost", {}, (e) => resolve(e)),
        );
        expect(err?.message).toContain("blocked non-public address");
    });

    it("permits private addresses only when allowPrivateAddresses is set", () => {
        const { client, Tcp } = makeClient();
        guardXmppConnections(client, true);
        expect(Tcp.prototype.socketParameters("xmpp://127.0.0.1:5222")).toEqual({
            host: "127.0.0.1",
            port: 5222,
        });
        // The setting is refreshed on every call, not frozen by the first one.
        guardXmppConnections(client, false);
        expect(() => Tcp.prototype.socketParameters("xmpp://127.0.0.1:5222")).toThrow(
            "blocked non-public address",
        );
    });

    it("refuses transports without a host/port socket (WebSocket)", () => {
        const { client, Ws } = makeClient();
        guardXmppConnections(client, true);
        expect(() => Ws.prototype.socketParameters("ws://127.0.0.1:8080/x")).toThrow(
            "unsupported XMPP transport",
        );
    });

    describe("with a real xmpp.js client", () => {
        type Entity = XmppClientInstance & {
            connect(service: string): Promise<unknown>;
            reconnect: { stop(): void };
        };

        const connectTo = async (
            service: string,
            allowPrivateAddresses: boolean,
            resolve = resolverFor({}),
        ) => {
            const xmpp = xmppClient({
                service,
                domain: "example.org",
                username: "u",
                password: "p",
                timeout: 2000,
            }) as Entity;
            const errors: Error[] = [];
            const statuses: string[] = [];
            xmpp.on("error", (err) => errors.push(err as Error));
            xmpp.on("status", (status) => statuses.push(status as string));
            guardXmppConnections(xmpp, allowPrivateAddresses, resolve);
            try {
                await xmpp.connect(service);
                return { error: undefined, errors, statuses };
            } catch (err) {
                return { error: err as Error, errors, statuses };
            } finally {
                xmpp.reconnect.stop();
                await xmpp.stop().catch(() => {});
            }
        };

        const withListener = async (run: (port: number) => Promise<void>) => {
            const state = { connections: 0 };
            const server = createServer((socket) => {
                state.connections++;
                socket.on("error", () => {});
                socket.destroy();
            });
            await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
            const { port } = server.address() as { port: number };
            try {
                await run(port);
            } finally {
                await new Promise((resolve) => server.close(resolve));
            }
            return state.connections;
        };

        const closedPort = async () => {
            const server = createServer();
            await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
            const { port } = server.address() as { port: number };
            await new Promise((resolve) => server.close(resolve));
            return port;
        };

        it("never opens a socket to a blocked loopback target", async () => {
            const connections = await withListener(async (port) => {
                const literal = await connectTo(`xmpp://127.0.0.1:${port}`, false);
                expect(literal.error?.message).toContain("blocked non-public address");
                const named = await connectTo(`xmpp://localhost:${port}`, false);
                expect(named.error?.message).toContain("blocked non-public address");
            });
            expect(connections).toBe(0);
        });

        it("reports a refused connect through the client, so reconnects are not silent", async () => {
            const result = await connectTo("xmpp://127.0.0.1:5222", false);
            expect(result.errors.map((e) => e.message)).toEqual(["blocked non-public address 127.0.0.1"]);
            expect(result.statuses).toContain("disconnect");
        });

        it("connects to loopback when allowPrivateAddresses is set", async () => {
            const connections = await withListener(async (port) => {
                expect((await connectTo(`xmpp://127.0.0.1:${port}`, true)).error).toBeUndefined();
                // Let the listener observe the accepted socket.
                await new Promise((resolve) => setTimeout(resolve, 20));
            });
            expect(connections).toBe(1);
        });

        it("falls back to the next SRV candidate when one fails", async () => {
            const down = await closedPort();
            const connections = await withListener(async (port) => {
                const resolve = resolverFor({
                    "_xmpp-client._tcp.example.org": [srv("127.0.0.1", down, 0), srv("127.0.0.1", port, 10)],
                });
                const result = await connectTo("example.org", true, resolve);
                expect(result.error).toBeUndefined();
                // The failed first candidate is not reported as a client error.
                // (The listener resetting the accepted socket may be.)
                expect(result.errors.some((e) => (e as Error & { code?: string }).code === "ECONNREFUSED")).toBe(
                    false,
                );
                await new Promise((resolve) => setTimeout(resolve, 20));
            });
            expect(connections).toBe(1);
        });

        it("skips a blocked SRV candidate in favour of the next one", async () => {
            const resolve = resolverFor({
                "_xmpp-client._tcp.example.org": [srv("127.0.0.1", 5222, 0), srv("10.0.0.1", 5222, 10)],
            });
            const result = await connectTo("example.org", false, resolve);
            expect(result.error?.message).toBe("blocked non-public address 10.0.0.1");
        });
    });
});
