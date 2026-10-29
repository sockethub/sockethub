import { describe, expect, it } from "bun:test";
import type { SrvRecord } from "node:dns";
import { createServer } from "node:net";
import { client as xmppClient, type XmppClientInstance } from "@xmpp/client";

import { discoverService, guardXmppConnections } from "./guard.js";

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

describe("discoverService", () => {
    it("passes explicit service URIs through untouched", async () => {
        const resolve = async () => {
            throw new Error("must not be called");
        };
        expect(await discoverService("xmpp://chat.example.org:5222", resolve)).toBe(
            "xmpp://chat.example.org:5222",
        );
    });

    it("falls back to xmpp://host:5222 without SRV records", async () => {
        expect(await discoverService("example.org", resolverFor({}))).toBe("xmpp://example.org:5222");
    });

    it("picks the best SRV record across xmpps and xmpp", async () => {
        const resolve = resolverFor({
            "_xmpps-client._tcp.example.org": [srv("tls.example.org", 5223, 10)],
            "_xmpp-client._tcp.example.org": [
                srv("low.example.org", 5222, 5, 1),
                srv("high.example.org", 5222, 5, 50),
            ],
        });
        expect(await discoverService("example.org", resolve)).toBe("xmpp://high.example.org:5222");
    });

    it("uses direct TLS when the xmpps record wins", async () => {
        const resolve = resolverFor({
            "_xmpps-client._tcp.example.org": [srv("tls.example.org", 5223, 0)],
            "_xmpp-client._tcp.example.org": [srv("plain.example.org", 5222, 10)],
        });
        expect(await discoverService("example.org", resolve)).toBe("xmpps://tls.example.org:5223");
    });

    it("ignores a '.' target, which marks the service unavailable", async () => {
        const resolve = resolverFor({
            "_xmpp-client._tcp.example.org": [srv(".", 0)],
        });
        expect(await discoverService("example.org", resolve)).toBe("xmpp://example.org:5222");
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

    it("runs discovery before every connect", async () => {
        const seen: string[] = [];
        const client = {
            transports: [],
            connect: async (service: string) => {
                seen.push(service);
            },
        } as unknown as XmppClientInstance & { connect(service: string): Promise<void> };
        guardXmppConnections(client, false, resolverFor({}));
        await client.connect("example.org");
        await client.connect("example.org");
        expect(seen).toEqual(["xmpp://example.org:5222", "xmpp://example.org:5222"]);
    });

    describe("with a real xmpp.js client", () => {
        const connectTo = async (service: string, allowPrivateAddresses: boolean) => {
            const xmpp = xmppClient({
                service,
                domain: "example.org",
                username: "u",
                password: "p",
                timeout: 2000,
            }) as XmppClientInstance & { connect(service: string): Promise<unknown> };
            xmpp.on("error", () => {});
            guardXmppConnections(xmpp, allowPrivateAddresses, resolverFor({}));
            try {
                await xmpp.connect(service);
                return undefined;
            } catch (err) {
                return err as Error;
            } finally {
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

        it("never opens a socket to a blocked loopback target", async () => {
            const connections = await withListener(async (port) => {
                const literal = await connectTo(`xmpp://127.0.0.1:${port}`, false);
                expect(literal?.message).toContain("blocked non-public address");
                const named = await connectTo(`xmpp://localhost:${port}`, false);
                expect(named?.message).toContain("blocked non-public address");
            });
            expect(connections).toBe(0);
        });

        it("connects to loopback when allowPrivateAddresses is set", async () => {
            const connections = await withListener(async (port) => {
                expect(await connectTo(`xmpp://127.0.0.1:${port}`, true)).toBeUndefined();
                // Let the listener observe the accepted socket.
                await new Promise((resolve) => setTimeout(resolve, 20));
            });
            expect(connections).toBe(1);
        });
    });
});
