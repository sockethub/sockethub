import type { IncomingMessage } from "node:http";
import type { Express } from "express";
import proxyaddr from "proxy-addr";
import { normalizeIp } from "./connection-scope.js";

/** The only header Express consults for `trust proxy`. */
const EXPRESS_FORWARDED_HEADER = "x-forwarded-for";

function configuredProxyHeader(proxyHeader: unknown): string {
    return typeof proxyHeader === "string" && proxyHeader.trim() !== ""
        ? proxyHeader.trim().toLowerCase()
        : EXPRESS_FORWARDED_HEADER;
}

/** Resolve socket admission using the same compiled proxy policy as Express req.ip. */
export function getRequestClientIp(
    request: IncomingMessage,
    app: Express,
): string {
    return normalizeIp(proxyaddr(request, app.get("trust proxy fn")));
}

/**
 * Client address for socket admission, per-IP quotas, and anonymous reconnect.
 *
 * `x-forwarded-for` is a chain. The nearest proxy appends the address it
 * actually accepted, and anything to the left of that may have been set by
 * the client. Reading the first entry treats that prefix as the client, so
 * an attacker can present a victim's address and, during janitor grace,
 * take over that victim's anonymous connection (the reconnect key is the
 * actor plus this address). Hop count is already what HTTP uses: one trusted
 * hop yields the address the proxy appended, not the spoofed prefix.
 *
 * A custom `proxyHeader` is not a chain Express understands. The operator
 * vouched for that header, and its first address is the value.
 */
export function resolveSocketClientIp(
    request: IncomingMessage,
    app: Express | undefined,
    reconnectIpSource: unknown,
    proxyHeader: unknown,
    fallbackAddress: string | undefined,
): string {
    const header = configuredProxyHeader(proxyHeader);
    if (reconnectIpSource === "proxy" && header !== EXPRESS_FORWARDED_HEADER) {
        const value = request.headers[header];
        const raw = Array.isArray(value) ? value[0] : value;
        if (typeof raw === "string") {
            const normalized = normalizeIp(raw);
            if (normalized) {
                return normalized;
            }
        }
        return normalizeIp(fallbackAddress);
    }
    if (app) {
        return getRequestClientIp(request, app);
    }
    return normalizeIp(fallbackAddress);
}

/**
 * Resolution of Express's `trust proxy` setting.
 *
 * Without it, `req.ip` is the socket peer — the reverse proxy — so every
 * proxied request shares one rate-limit bucket, and `express-rate-limit`
 * raises ERR_ERL_UNEXPECTED_X_FORWARDED_FOR when it sees the header it has
 * been told not to believe.
 */

export type TrustProxySetting = boolean | number | string;

/**
 * Coerce a configured value into something Express accepts. Environment
 * variables arrive as strings, where `"true"`/`"false"` mean the booleans and
 * a numeric string means a hop count — Express would otherwise read either as
 * a subnet name.
 */
function normalize(value: unknown): TrustProxySetting {
    if (typeof value === "boolean" || typeof value === "number") {
        return value;
    }
    if (typeof value !== "string") {
        return false;
    }
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "false") {
        return false;
    }
    if (trimmed === "true") {
        return true;
    }
    if (/^\d+$/.test(trimmed)) {
        return Number(trimmed);
    }
    return trimmed;
}

/**
 * The `trust proxy` value to apply, given the configured `sockethub.trustProxy`
 * and the `credentialCheck` reconnect settings. Declaring `reconnectIpSource:
 * "proxy"` already states that a trusted proxy sets the forwarded header, so
 * an otherwise-unset `trustProxy` follows it and trusts a single hop, keeping
 * the socket and HTTP paths from disagreeing about who the client is.
 *
 * That inference only holds while the socket path reads the same header
 * Express does. A deployment naming a custom `proxyHeader` has vouched for
 * that header alone; its proxy may well leave `x-forwarded-for` untouched and
 * client-settable, and trusting it would hand clients control of their own
 * HTTP rate-limit identity. Such a deployment must set `trustProxy`
 * explicitly.
 */
export function resolveTrustProxy(
    configured: unknown,
    reconnectIpSource: unknown,
    proxyHeader?: unknown,
): TrustProxySetting {
    const normalized = normalize(configured);
    if (normalized !== false || reconnectIpSource !== "proxy") {
        return normalized;
    }
    // Unset matches the schema default, which is x-forwarded-for.
    const header = configuredProxyHeader(proxyHeader);
    return header === EXPRESS_FORWARDED_HEADER ? 1 : false;
}
