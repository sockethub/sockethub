import { promises as dns, type SrvRecord } from "node:dns";
import { isIP } from "node:net";
import { toError } from "@sockethub/util/error";
import { createGuardedLookup, isBlockedAddress } from "@sockethub/util/net";
import type { XmppClientInstance } from "@xmpp/client";

export type ResolveSrv = (name: string) => Promise<SrvRecord[]>;

/**
 * Turn a bare host into an ordered list of explicit `xmpp://` / `xmpps://`
 * service URIs using the RFC 6120 / XEP-0368 SRV records, falling back to
 * `xmpp://host:5222` when neither SRV name exists. Already-explicit URIs are
 * returned as the only candidate.
 *
 * Doing this here, instead of handing xmpp.js a bare host, keeps
 * `@xmpp/resolve` from running its HTTP host-meta discovery (an unguarded
 * global `fetch` to the client-chosen host) and from following host-meta
 * links onto the WebSocket transport.
 */
export async function discoverServices(
    service: string,
    resolveSrv: ResolveSrv = dns.resolveSrv,
): Promise<string[]> {
    if (service.includes("://")) {
        return [service];
    }
    const lookups = (["xmpps", "xmpp"] as const).map(async (scheme) => {
        try {
            const records = await resolveSrv(
                `_${scheme}-client._tcp.${service}`,
            );
            return records.map((record) => ({ ...record, scheme }));
        } catch {
            // No SRV record (or a DNS failure) for this scheme: fall back below.
            return [];
        }
    });
    const answers = await Promise.all(lookups);
    // RFC 2782: a lone "." target means the service is decidedly not
    // available, so it must not trigger the host fallback. Node's resolver
    // reports that root target as an empty name.
    const isRoot = (name: string) => name === "" || name === ".";
    const unavailable = answers.some(
        (records) => records.length === 1 && isRoot(records[0].name),
    );
    const records = answers
        .flat()
        .filter((record) => !isRoot(record.name))
        .sort((a, b) => a.priority - b.priority || b.weight - a.weight);
    if (records.length === 0) {
        if (unavailable) {
            throw new Error(`XMPP service is not available at ${service}`);
        }
        return [`xmpp://${service}:5222`];
    }
    return records.map((record) => {
        const host = isIP(record.name) === 6 ? `[${record.name}]` : record.name;
        return `${record.scheme}://${host}:${record.port}`;
    });
}

type SocketParams = { host?: unknown; lookup?: unknown };

interface GuardedTransportPrototype {
    socketParameters(service: string): unknown;
    __sockethubGuardOriginal?: (service: string) => unknown;
    __sockethubAllowPrivateAddresses?: boolean;
}

/**
 * Refuse XMPP connections to loopback, private, link-local, and cloud
 * metadata addresses, matching the outbound guard used by the HTTP platforms.
 *
 * - Each (re)connect first runs {@link discoverServices} and tries the
 *   resulting `xmpp://` / `xmpps://` candidates in order.
 * - Every socket gets the shared guarded DNS lookup, which checks the address
 *   actually connected to. IP-literal hosts skip DNS, so they are checked
 *   directly. Transports that do not use a host/port socket (WebSocket) are
 *   refused outright.
 *
 * The transport wrapper lives on the shared module-level prototypes, like
 * {@link setTlsServername}, and its setting is refreshed on every call.
 */
export function guardXmppConnections(
    client: XmppClientInstance,
    allowPrivateAddresses: boolean,
    resolveSrv?: ResolveSrv,
): void {
    for (const transport of client.transports ?? []) {
        const proto = transport.prototype as GuardedTransportPrototype;
        if (!proto.__sockethubGuardOriginal) {
            const original = proto.socketParameters;
            proto.__sockethubGuardOriginal = original;
            proto.socketParameters = function (service: string) {
                const params = original.call(this, service);
                if (params === undefined) {
                    return params;
                }
                const allow = proto.__sockethubAllowPrivateAddresses === true;
                if (
                    !params ||
                    typeof params !== "object" ||
                    typeof (params as SocketParams).host !== "string"
                ) {
                    throw new Error(
                        `unsupported XMPP transport for ${service}`,
                    );
                }
                const socketParams = params as SocketParams & { host: string };
                // net.connect wants IPv6 literals without brackets.
                const host = socketParams.host.replace(/^\[|\]$/g, "");
                socketParams.host = host;
                if (isIP(host) !== 0) {
                    if (!allow && isBlockedAddress(host)) {
                        throw new Error(`blocked non-public address ${host}`);
                    }
                } else {
                    socketParams.lookup = createGuardedLookup(allow);
                }
                return socketParams;
            };
        }
        proto.__sockethubAllowPrivateAddresses = allowPrivateAddresses;
    }

    const entity = client as GuardedEntity;
    if (typeof entity.connect !== "function") {
        return;
    }
    // Replaces the `@xmpp/resolve` connect wrapper. Like its fallback, each
    // candidate socket is only attached to the client once it connects, so a
    // failed candidate does not surface as a client error before the next one
    // is tried.
    //
    // An unattached candidate is invisible to `stop()`, so stop is wrapped to
    // abort it. Otherwise a reconnect still in flight when the platform
    // cleans up would attach to the discarded client and log in.
    const attempts: Attempts = { stops: 0, pending: new Set() };
    const stop = entity.stop;
    entity.stop = function (this: GuardedEntity) {
        attempts.stops++;
        for (const abort of attempts.pending) {
            abort();
        }
        attempts.pending.clear();
        return stop.call(this);
    };
    entity.connect = async function (this: GuardedEntity, service: string) {
        const stops = attempts.stops;
        const assertNotStopped = () => {
            if (attempts.stops !== stops) {
                throw new StoppedError();
            }
        };
        let lastError: unknown;
        let uris: string[] = [];
        try {
            uris = await discoverServices(service, resolveSrv);
        } catch (err) {
            lastError = err;
        }
        assertNotStopped();
        for (const uri of uris) {
            try {
                await connectCandidate(
                    this,
                    uri,
                    allowPrivateAddresses,
                    attempts,
                    assertNotStopped,
                );
                return;
            } catch (err) {
                if (err instanceof StoppedError) {
                    throw err;
                }
                lastError = err;
            }
        }
        const error = toError(
            lastError ?? new Error(`could not connect to ${service}`),
        );
        // Report through the client like a socket failure would. The
        // reconnect plugin discards the rejection, so without this a failed
        // automatic reconnect would go unnoticed and never be retried.
        this._reset();
        this._status("disconnect");
        this.emit("error", error);
        throw error;
    };
}

/** Raised when the client is stopped while a connect is in flight. */
class StoppedError extends Error {
    constructor() {
        super("XMPP client stopped while connecting");
    }
}

interface Attempts {
    /** Incremented by every `stop()`; a connect compares it to bail out. */
    stops: number;
    /** Aborts for candidate sockets that are connecting but not attached. */
    pending: Set<() => void>;
}

type CandidateSocket = NodeJS.EventEmitter & {
    connect(params: unknown): void;
    destroy?: () => void;
    /** `@xmpp/tls` wraps the real TLS socket here. */
    socket?: { destroy(): void };
};

type Transport = {
    prototype: {
        socketParameters(service: string): unknown;
        Socket: new () => CandidateSocket;
        Parser: unknown;
    };
};

/** The xmpp.js client internals `@xmpp/resolve` itself uses to connect. */
type GuardedEntity = XmppClientInstance & {
    connect?: (service: string) => Promise<void>;
    emit(event: string, ...args: unknown[]): boolean;
    _findTransport(service: string): Transport | undefined;
    _attachSocket(socket: unknown): void;
    _status(status: string, ...args: unknown[]): void;
    _reset(): void;
    Transport?: Transport;
    Socket?: unknown;
    Parser?: unknown;
};

async function connectCandidate(
    entity: GuardedEntity,
    uri: string,
    allowPrivateAddresses: boolean,
    attempts: Attempts,
    assertNotStopped: () => void,
): Promise<void> {
    // Fail with a clear error here; the transport wrapper's refusal surfaces
    // from `_findTransport` as "no transport".
    const host = new URL(uri).hostname.replace(/^\[|\]$/g, "");
    if (!allowPrivateAddresses && isIP(host) !== 0 && isBlockedAddress(host)) {
        throw new Error(`blocked non-public address ${host}`);
    }
    const Transport = entity._findTransport(uri);
    if (!Transport) {
        throw new Error(`no XMPP transport for ${uri}`);
    }
    entity._status("connecting", uri);
    const socket = new Transport.prototype.Socket();
    let abort = () => {};
    try {
        await new Promise<void>((resolve, reject) => {
            const onConnect = () => {
                socket.removeListener("error", onError);
                resolve();
            };
            const onError = (err: unknown) => {
                socket.removeListener("connect", onConnect);
                reject(err);
            };
            abort = () => {
                socket.removeListener("connect", onConnect);
                socket.removeListener("error", onError);
                socket.on("error", () => {});
                if (typeof socket.destroy === "function") {
                    socket.destroy();
                } else {
                    socket.socket?.destroy();
                }
                reject(new StoppedError());
            };
            attempts.pending.add(abort);
            socket.once("connect", onConnect);
            socket.once("error", onError);
            socket.connect(Transport.prototype.socketParameters(uri));
        });
    } finally {
        attempts.pending.delete(abort);
    }
    // Belt and braces: never attach once the client has been stopped.
    try {
        assertNotStopped();
    } catch (err) {
        abort();
        throw err;
    }
    entity._attachSocket(socket);
    socket.emit("connect");
    entity.Transport = Transport;
    entity.Socket = Transport.prototype.Socket;
    entity.Parser = Transport.prototype.Parser;
}
