import { expect } from "chai";
import EventEmitter from "eventemitter3";

import SockethubClient, {
    DiscoveryError,
    discoverSockethub,
} from "./sockethub-client";

const descriptor = {
    name: "sockethub",
    apiVersion: 5,
    endpoints: {
        socket: { origin: "https://sh.example.org", path: "/ws" },
        httpActions: "https://sh.example.org/actions",
    },
    platforms: [{ id: "dummy", apiVersion: 3 }],
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function fetchReturning(response: Response | Error) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const doFetch = (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (response instanceof Error) {
            throw response;
        }
        return response;
    }) as unknown as typeof fetch;
    return { doFetch, calls };
}

function fakeSocket() {
    const socket = new EventEmitter() as EventEmitter & {
        connected: boolean;
        id: string;
        io: object;
        connect: () => void;
        disconnect: () => void;
    };
    socket.connected = false;
    socket.id = "";
    socket.io = {};
    socket.connect = () => {};
    socket.disconnect = () => {};
    return socket;
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise;
    } catch (err) {
        return err as Error;
    }
    throw new Error("expected promise to reject");
}

describe("discoverSockethub", () => {
    it("fetches the base URL asking for JSON and returns the descriptor", async () => {
        const { doFetch, calls } = fetchReturning(jsonResponse(descriptor));

        const result = await discoverSockethub("https://sh.example.org", {
            fetch: doFetch,
        });

        expect(result).to.deep.equal(descriptor);
        expect(calls).to.have.length(1);
        expect(calls[0].url).to.equal("https://sh.example.org/");
        expect(
            (calls[0].init?.headers as Record<string, string>).accept,
        ).to.equal("application/json");
        expect(calls[0].init?.signal).to.be.instanceOf(AbortSignal);
    });

    it("keeps a path prefix on the base URL", async () => {
        const { doFetch, calls } = fetchReturning(jsonResponse(descriptor));
        await discoverSockethub("http://localhost:10550/prefix/", {
            fetch: doFetch,
        });
        expect(calls[0].url).to.equal("http://localhost:10550/prefix/");
    });

    it("rejects a base URL that is not absolute http(s)", async () => {
        for (const bad of ["sh.example.org", "/sockethub", "ws://x.example"]) {
            const err = await rejection(
                discoverSockethub(bad, { fetch: fetchReturning(new Error("no")).doFetch }),
            );
            expect(err).to.be.instanceOf(DiscoveryError);
            expect(err.message).to.contain(bad);
        }
    });

    it("rejects when the server is unreachable", async () => {
        const cause = new TypeError("fetch failed");
        const err = await rejection(
            discoverSockethub("https://down.example", {
                fetch: fetchReturning(cause).doFetch,
            }),
        );
        expect(err).to.be.instanceOf(DiscoveryError);
        expect(err.message).to.contain("could not reach https://down.example/");
        expect(err.message).to.contain("fetch failed");
        expect((err as DiscoveryError).cause).to.equal(cause);
    });

    it("rejects when discovery times out", async () => {
        const doFetch = ((_url: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener("abort", () =>
                    reject(new DOMException("aborted", "AbortError")),
                );
            })) as unknown as typeof fetch;
        const err = await rejection(
            discoverSockethub("https://slow.example", {
                fetch: doFetch,
                discoveryTimeoutMs: 10,
            }),
        );
        expect(err).to.be.instanceOf(DiscoveryError);
        expect(err.message).to.contain("timed out after 10ms");
    });

    it("rejects when the body stalls after the headers arrived", async () => {
        const doFetch = ((_url: string, init?: RequestInit) => {
            // Headers arrive at once; the body never does unless aborted.
            const body = new ReadableStream<Uint8Array>({
                start(controller) {
                    init?.signal?.addEventListener("abort", () =>
                        controller.error(
                            new DOMException("aborted", "AbortError"),
                        ),
                    );
                },
            });
            return Promise.resolve(
                new Response(body, {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
            );
        }) as unknown as typeof fetch;
        const err = await rejection(
            discoverSockethub("https://slow.example", {
                fetch: doFetch,
                discoveryTimeoutMs: 10,
            }),
        );
        expect(err).to.be.instanceOf(DiscoveryError);
        expect(err.message).to.contain("timed out after 10ms while sending");
    });

    it("rejects a non-2xx answer", async () => {
        const err = await rejection(
            discoverSockethub("https://sh.example.org", {
                fetch: fetchReturning(jsonResponse({ error: "nope" }, 503))
                    .doFetch,
            }),
        );
        expect(err).to.be.instanceOf(DiscoveryError);
        expect(err.message).to.contain("answered 503");
    });

    it("rejects a non-JSON body", async () => {
        const html = new Response("<!doctype html><title>Hi</title>", {
            status: 200,
            headers: { "content-type": "text/html" },
        });
        const err = await rejection(
            discoverSockethub("https://sh.example.org", {
                fetch: fetchReturning(html).doFetch,
            }),
        );
        expect(err).to.be.instanceOf(DiscoveryError);
        expect(err.message).to.contain("did not return JSON");
    });

    it("rejects JSON that is not a service descriptor", async () => {
        for (const bad of [
            { name: "other", apiVersion: 5, platforms: [] },
            { ...descriptor, apiVersion: "5" },
            { ...descriptor, endpoints: { socket: { origin: "x" } } },
            [],
            null,
        ]) {
            const err = await rejection(
                discoverSockethub("https://sh.example.org", {
                    fetch: fetchReturning(jsonResponse(bad)).doFetch,
                }),
            );
            expect(err).to.be.instanceOf(DiscoveryError);
            expect(err.message).to.contain("valid service descriptor");
        }
    });
});

describe("SockethubClient.connect", () => {
    it("connects with the discovered origin and path and exposes the descriptor", async () => {
        const socket = fakeSocket();
        const ioCalls: Array<{ uri: string; opts?: object }> = [];
        const io = ((uri: string, opts?: object) => {
            ioCalls.push({ uri, opts });
            return socket;
        }) as never;

        const sc = await SockethubClient.connect("https://sh.example.org", {
            io,
            fetch: fetchReturning(jsonResponse(descriptor)).doFetch,
            socketOptions: { transports: ["websocket"], path: "/ignored" },
            initTimeoutMs: 1234,
        });

        expect(ioCalls).to.deep.equal([
            {
                uri: "https://sh.example.org",
                opts: { transports: ["websocket"], path: "/ws" },
            },
        ]);
        expect(sc).to.be.instanceOf(SockethubClient);
        expect(sc.descriptor).to.deep.equal(descriptor);
        expect(sc.descriptor?.endpoints?.httpActions).to.equal(
            "https://sh.example.org/actions",
        );
        expect(sc.getInitState()).to.equal("idle");
    });

    it("rejects without creating a socket when discovery fails", async () => {
        let created = false;
        const io = (() => {
            created = true;
            return fakeSocket();
        }) as never;

        const err = await rejection(
            SockethubClient.connect("https://down.example", {
                io,
                fetch: fetchReturning(new TypeError("fetch failed")).doFetch,
            }),
        );

        expect(err).to.be.instanceOf(DiscoveryError);
        expect(created).to.equal(false);
    });

    it("rejects an older server that advertises no endpoints", async () => {
        const { endpoints: _omitted, ...legacy } = descriptor;
        const err = await rejection(
            SockethubClient.connect("https://old.example", {
                io: (() => fakeSocket()) as never,
                fetch: fetchReturning(jsonResponse(legacy)).doFetch,
            }),
        );
        expect(err).to.be.instanceOf(DiscoveryError);
        expect(err.message).to.contain("does not advertise a Socket.IO endpoint");
    });

    it("rejects a downgrade from an https base URL to an http socket origin", async () => {
        let created = false;
        const insecure = {
            ...descriptor,
            endpoints: {
                socket: { origin: "http://localhost:10550", path: "/sockethub" },
            },
        };
        const err = await rejection(
            SockethubClient.connect("https://sh.example.org", {
                io: (() => {
                    created = true;
                    return fakeSocket();
                }) as never,
                fetch: fetchReturning(jsonResponse(insecure)).doFetch,
            }),
        );
        expect(err).to.be.instanceOf(DiscoveryError);
        expect(err.message).to.contain("plaintext socket origin");
        expect(err.message).to.contain("allowInsecureSocket");
        expect(created).to.equal(false);
    });

    it("accepts the downgrade when allowInsecureSocket is set", async () => {
        const insecure = {
            ...descriptor,
            endpoints: {
                socket: { origin: "http://localhost:10550", path: "/sockethub" },
            },
        };
        const ioCalls: Array<string> = [];
        const sc = await SockethubClient.connect("https://sh.example.org", {
            io: ((uri: string) => {
                ioCalls.push(uri);
                return fakeSocket();
            }) as never,
            fetch: fetchReturning(jsonResponse(insecure)).doFetch,
            allowInsecureSocket: true,
        });
        expect(sc).to.be.instanceOf(SockethubClient);
        expect(ioCalls).to.deep.equal(["http://localhost:10550"]);
    });

    it("allows http to http, as in local development", async () => {
        const local = {
            ...descriptor,
            endpoints: {
                socket: { origin: "http://localhost:10550", path: "/sockethub" },
            },
        };
        const sc = await SockethubClient.connect("http://localhost:10550", {
            io: (() => fakeSocket()) as never,
            fetch: fetchReturning(jsonResponse(local)).doFetch,
        });
        expect(sc).to.be.instanceOf(SockethubClient);
    });

    it("rejects a socket origin that is not an http(s) URL", async () => {
        for (const origin of ["ftp://sh.example.org", "javascript:alert(1)", "not a url"]) {
            const bad = {
                ...descriptor,
                endpoints: { socket: { origin, path: "/sockethub" } },
            };
            const err = await rejection(
                SockethubClient.connect("https://sh.example.org", {
                    io: (() => fakeSocket()) as never,
                    fetch: fetchReturning(jsonResponse(bad)).doFetch,
                }),
            );
            expect(err, origin).to.be.instanceOf(DiscoveryError);
        }
    });

    it("uses a global io() when none is passed", async () => {
        const g = globalThis as { io?: unknown };
        const previous = g.io;
        const socket = fakeSocket();
        let uri: string | undefined;
        g.io = (u: string) => {
            uri = u;
            return socket;
        };
        try {
            const sc = await SockethubClient.connect("https://sh.example.org", {
                fetch: fetchReturning(jsonResponse(descriptor)).doFetch,
            });
            expect(uri).to.equal("https://sh.example.org");
            expect(sc.descriptor).to.deep.equal(descriptor);
        } finally {
            if (previous === undefined) {
                delete g.io;
            } else {
                g.io = previous;
            }
        }
    });

    it("leaves the descriptor undefined for a client built from a socket", () => {
        const sc = new SockethubClient(fakeSocket() as never);
        expect(sc.descriptor).to.equal(undefined);
    });
});
