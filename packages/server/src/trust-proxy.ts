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
 * and `credentialCheck.reconnectIpSource`. Declaring `reconnectIpSource:
 * "proxy"` already states that a trusted proxy sets the forwarded header, so
 * an otherwise-unset `trustProxy` follows it and trusts a single hop, keeping
 * the socket and HTTP paths from disagreeing about who the client is.
 */
export function resolveTrustProxy(
    configured: unknown,
    reconnectIpSource: unknown,
): TrustProxySetting {
    const normalized = normalize(configured);
    if (normalized === false && reconnectIpSource === "proxy") {
        return 1;
    }
    return normalized;
}
