import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import { Agent, buildConnector } from "undici";
import { isBlockedAddress } from "./address.js";

/** Default response-body cap (5 MiB) applied by a guarded dispatcher. */
export const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export interface GuardedDispatcherOptions {
    /**
     * When true, skip the private/loopback destination checks. Dev/test escape
     * hatch only — never enable on a server that accepts untrusted requests.
     */
    allowPrivateAddresses?: boolean;
    /** Cap on response body size in bytes. Defaults to 5 MiB. */
    maxResponseBytes?: number;
}

type LookupOptions = { all?: boolean; family?: number } & Record<
    string,
    unknown
>;
type LookupCallback = (
    err: NodeJS.ErrnoException | null,
    address?: string | Array<LookupAddress>,
    family?: number,
) => void;

/**
 * A DNS lookup that resolves a hostname and rejects the connection if any
 * resolved address is private/loopback/blocked. Because this runs at the
 * connection layer, it validates the address actually being connected to —
 * including on every redirect hop — closing the check-then-fetch (TOCTOU)
 * rebinding gap that a pre-fetch URL check leaves open.
 *
 * Exported for direct unit testing: the Bun test runner intercepts `fetch` and
 * ignores undici dispatchers, so the lookup decision is verified here rather
 * than through an end-to-end fetch.
 */
export function createGuardedLookup(
    allowPrivateAddresses: boolean,
): LookupFunction {
    return (
        hostname: string,
        // net.connect passes a LookupOptions object; the legacy dns.lookup
        // signature allows a numeric `family`, which we preserve.
        options: LookupOptions | number,
        callback: LookupCallback,
    ): void => {
        const opts: LookupOptions =
            typeof options === "number" ? { family: options } : (options ?? {});
        dnsLookup(hostname, { ...opts, all: true }, (err, addresses) => {
            if (err) {
                callback(err);
                return;
            }
            if (!addresses || addresses.length === 0) {
                callback(
                    Object.assign(new Error(`could not resolve ${hostname}`), {
                        code: "ENOTFOUND",
                    }),
                );
                return;
            }
            if (!allowPrivateAddresses) {
                for (const { address } of addresses) {
                    if (isBlockedAddress(address)) {
                        callback(
                            new Error(
                                `blocked non-public address ${address} for ${hostname}`,
                            ),
                        );
                        return;
                    }
                }
            }
            if (opts.all) {
                callback(null, addresses);
            } else {
                callback(null, addresses[0].address, addresses[0].family);
            }
        });
    };
}

type Connector = ReturnType<typeof buildConnector>;

/**
 * Wrap Undici's connector so IP-literal hosts are checked before Node opens a
 * socket. Node bypasses custom DNS lookup functions for literals, so the
 * lookup guard alone does not cover these destinations.
 *
 * Exported for direct unit testing with an injected connector.
 */
export function createGuardedConnector(
    allowPrivateAddresses: boolean,
    connector: Connector = buildConnector({
        lookup: createGuardedLookup(allowPrivateAddresses),
    }),
): Connector {
    return (options, callback): void => {
        const hostname = options.hostname.replace(/^\[|\]$/g, "");
        if (
            !allowPrivateAddresses &&
            isIP(hostname) !== 0 &&
            isBlockedAddress(hostname)
        ) {
            callback(new Error(`blocked non-public address ${hostname}`), null);
            return;
        }
        connector(options, callback);
    };
}

/**
 * Build an undici {@link Agent} that defends a server fetching client-supplied
 * URLs against SSRF and memory exhaustion:
 *
 * - Every connection (including each redirect hop) resolves DNS and refuses to
 *   connect to a private/loopback/link-local/metadata address (unless
 *   `allowPrivateAddresses` is set).
 * - Responses larger than `maxResponseBytes` are aborted.
 *
 * Pass the returned dispatcher to `fetch(url, { dispatcher })`, or to any
 * library that forwards fetch options (e.g. open-graph-scraper's
 * `fetchOptions`).
 */
export function createGuardedDispatcher(
    options: GuardedDispatcherOptions = {},
): Agent {
    const {
        allowPrivateAddresses = false,
        maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    } = options;
    return new Agent({
        maxResponseSize: maxResponseBytes,
        connect: createGuardedConnector(allowPrivateAddresses),
    });
}
