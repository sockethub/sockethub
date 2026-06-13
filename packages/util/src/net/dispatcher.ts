import { lookup as dnsLookup } from "node:dns";
import { Agent } from "undici";
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

// Node's net `lookup` callback shapes: single-address (all=false) and
// all-addresses (all=true). undici/net may request either form.
type LookupAddress = { address: string; family: number };
type LookupOptions = { all?: boolean } & Record<string, unknown>;
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
export function createGuardedLookup(allowPrivateAddresses: boolean) {
    return (
        hostname: string,
        options: LookupOptions | number,
        callback: LookupCallback,
    ): void => {
        const opts: LookupOptions =
            typeof options === "object" && options !== null ? options : {};
        dnsLookup(hostname, { ...opts, all: true }, (err, result) => {
            if (err) {
                callback(err);
                return;
            }
            const addresses = result as unknown as Array<LookupAddress>;
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
        connect: {
            // biome-ignore lint/suspicious/noExplicitAny: net lookup signature
            lookup: createGuardedLookup(allowPrivateAddresses) as any,
        },
    });
}
