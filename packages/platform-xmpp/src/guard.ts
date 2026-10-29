import { isIP } from "node:net";
import { createGuardedLookup, isBlockedAddress } from "@sockethub/util/net";
import type { XmppClientInstance } from "@xmpp/client";
import hostMeta from "@xmpp/resolve/lib/http.js";

/**
 * Turn off `@xmpp/resolve`'s HTTP host-meta discovery. For a bare host it
 * makes an unguarded `fetch` to `https://<host>/.well-known/host-meta`, and
 * its links can switch the client onto the WebSocket transport. SRV and A
 * lookups are unaffected.
 *
 * This patches xmpp.js internals, so recheck it on every `@xmpp/*` bump:
 * - it depends on the internal path `lib/http.js`, and on `resolve.js`
 *   reading `http.resolve` at call time;
 * - it only works if it modifies the same module copy the client uses. The
 *   platform's `dist` bundles `@xmpp/resolve`, so a `require` from
 *   `node_modules` would patch a copy nothing calls. `dist.test.ts` checks
 *   the built bundle.
 */
hostMeta.resolve = async () => [];

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
 * Every socket gets the shared guarded DNS lookup, which checks the address
 * actually connected to. IP-literal hosts skip DNS, so they are checked
 * directly; `@xmpp/resolve` turns SRV and A records into IP literals, so
 * discovered candidates are checked here too. Transports that do not use a
 * host/port socket (WebSocket) are refused outright. xmpp.js treats a
 * refusal as "no transport" and skips that candidate.
 *
 * The wrapper lives on the shared module-level prototypes, like
 * {@link setTlsServername}, and its setting is refreshed on every call.
 */
export function guardXmppConnections(
    client: XmppClientInstance,
    allowPrivateAddresses: boolean,
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
}
