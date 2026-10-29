import { promises as dns, type SrvRecord } from "node:dns";
import { isIP } from "node:net";
import { createGuardedLookup, isBlockedAddress } from "@sockethub/util/net";
import type { XmppClientInstance } from "@xmpp/client";

export type ResolveSrv = (name: string) => Promise<SrvRecord[]>;

/**
 * Turn a bare host into an explicit `xmpp://` / `xmpps://` service URI using
 * the RFC 6120 / XEP-0368 SRV records, falling back to `xmpp://host:5222`.
 * Already-explicit URIs are returned unchanged.
 *
 * Doing this here, instead of handing xmpp.js a bare host, keeps
 * `@xmpp/resolve` from running its HTTP host-meta discovery (an unguarded
 * global `fetch` to the client-chosen host) and from following host-meta
 * links onto the WebSocket transport.
 */
export async function discoverService(
    service: string,
    resolveSrv: ResolveSrv = dns.resolveSrv,
): Promise<string> {
    if (service.includes("://")) {
        return service;
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
    const records = (await Promise.all(lookups))
        .flat()
        // A target of "." means the service is decidedly not available.
        .filter((record) => record.name && record.name !== ".")
        .sort((a, b) => a.priority - b.priority || b.weight - a.weight);
    const best = records[0];
    if (!best) {
        return `xmpp://${service}:5222`;
    }
    const host = isIP(best.name) === 6 ? `[${best.name}]` : best.name;
    return `${best.scheme}://${host}:${best.port}`;
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
 * - Each (re)connect first runs {@link discoverService}, so xmpp.js only ever
 *   sees explicit `xmpp://` / `xmpps://` URIs.
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

    const instance = client as XmppClientInstance & {
        connect?: (service: string) => Promise<unknown>;
    };
    const connect = instance.connect;
    if (typeof connect === "function") {
        instance.connect = async function (service: string) {
            const uri = await discoverService(service, resolveSrv);
            // Fail with a clear error here; the transport wrapper's refusal
            // surfaces from xmpp.js as "No compatible connection method".
            const host = new URL(uri).hostname.replace(/^\[|\]$/g, "");
            if (
                !allowPrivateAddresses &&
                isIP(host) !== 0 &&
                isBlockedAddress(host)
            ) {
                throw new Error(`blocked non-public address ${host}`);
            }
            return connect.call(this, uri);
        };
    }
}
