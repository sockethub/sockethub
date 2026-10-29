import { describe, expect, it } from "bun:test";
import { createServer } from "node:net";
import { client as xmppClient, type XmppClientInstance } from "@xmpp/client";
import hostMeta from "@xmpp/resolve/lib/http.js";

import { guardXmppConnections } from "./guard.js";

it("turns off host-meta discovery", async () => {
    expect(await hostMeta.resolve("example.org")).toEqual([]);
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

        const connectTo = async (service: string, allowPrivateAddresses: boolean) => {
            const xmpp = xmppClient({
                service,
                domain: "example.org",
                username: "u",
                password: "p",
                timeout: 2000,
            }) as Entity;
            xmpp.reconnect.stop();
            xmpp.on("error", () => {});
            guardXmppConnections(xmpp, allowPrivateAddresses);
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
                // xmpp.js reports a refused IP literal as having no transport.
                expect((await connectTo(`xmpp://127.0.0.1:${port}`, false))?.message).toContain(
                    "No compatible connection method found",
                );
                expect((await connectTo(`xmpp://localhost:${port}`, false))?.message).toContain(
                    "blocked non-public address",
                );
                // A bare host resolves to IP literals, which are all refused.
                expect(await connectTo("localhost", false)).toBeInstanceOf(Error);
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
