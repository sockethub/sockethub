import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import type { XmppElement } from "@xmpp/client";

import type { XmppBuiltCredentials, XmppCredentialsObject } from "./types.js";

interface XDataFieldResult {
    var: string;
    field: {
        type: string;
        label?: string;
        value: string | number | boolean | string[] | null;
        options?: Array<{ label: string; value: string }>;
    };
}

const ALLOWED_SCHEMES = new Set(["xmpp:", "xmpps:"]);

/**
 * Accept a bare host name, an IPv4 literal, or a bracketed IPv6 literal.
 * Anything carrying a scheme, port, path, query, or userinfo is rejected, so
 * a client cannot steer xmpp.js onto its WebSocket transport or HTTP
 * host-meta discovery.
 */
function isPlainHost(host: string): boolean {
    if (host.startsWith("[") && host.endsWith("]")) {
        return isIP(host.slice(1, -1)) === 6;
    }
    // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them
    return host.length > 0 && !/[\s\x00-\x1f\x7f/?#@:[\]\\%]/.test(host);
}

const INVALID_SERVER =
    "xmpp credentials.object.server must be a host name, or an xmpp:// or xmpps:// URI without a path";

/**
 * Convert a validated host to the form DNS and sockets expect: IP literals
 * are kept, and internationalized names become their IDNA ASCII form.
 * Returns "" when the name is not a valid host.
 */
function toConnectHost(host: string): string {
    if (host.startsWith("[") || isIP(host) !== 0) {
        return host;
    }
    return domainToASCII(host);
}

/**
 * Turn the client-supplied `server` override into either a bare host (left to
 * SRV discovery) or an explicit `xmpp://` / `xmpps://` service URI.
 */
function buildService(server: string, port: number | undefined): string {
    if (!server.includes("://")) {
        const host = isPlainHost(server) ? toConnectHost(server) : "";
        if (!host) {
            throw new Error(INVALID_SERVER);
        }
        return port ? `xmpp://${host}:${port}` : host;
    }
    let url: URL;
    try {
        url = new URL(server);
    } catch {
        throw new Error("xmpp credentials.object.server is not a valid URI");
    }
    if (
        !ALLOWED_SCHEMES.has(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password ||
        (url.pathname !== "" && url.pathname !== "/") ||
        url.search ||
        url.hash
    ) {
        throw new Error(INVALID_SERVER);
    }
    // xmpp: is not a special URL scheme, so a non-ASCII host comes back
    // percent-encoded rather than IDNA-encoded.
    let decoded = "";
    try {
        decoded = decodeURIComponent(url.hostname);
    } catch {
        // Malformed percent-encoding: rejected below.
    }
    // Check before IDNA conversion, which silently truncates at "/".
    const host = isPlainHost(decoded) ? toConnectHost(decoded) : "";
    if (!host) {
        throw new Error(INVALID_SERVER);
    }
    const effectivePort = port ?? (url.port ? Number(url.port) : undefined);
    return effectivePort
        ? `${url.protocol}//${host}:${effectivePort}`
        : `${url.protocol}//${host}`;
}

export const utils = {
    buildXmppCredentials: (
        credentials: XmppCredentialsObject,
    ): XmppBuiltCredentials => {
        const userAddress = credentials.object.userAddress;
        if (typeof userAddress !== "string" || !userAddress.includes("@")) {
            throw new Error(
                "xmpp credentials.object.userAddress must be a JID in the form 'user@server'",
            );
        }
        const [username, server] = userAddress.split("@");
        if (!username || !server) {
            throw new Error(
                "xmpp credentials.object.userAddress is missing the username or server portion",
            );
        }
        if (!isPlainHost(server)) {
            throw new Error(
                "xmpp credentials.object.userAddress server portion must be a host name",
            );
        }
        const xmpp_creds: XmppBuiltCredentials = {
            service: buildService(
                credentials.object.server || server,
                credentials.object.port,
            ),
            domain: server,
            username: username,
            password: credentials.object.password,
        };
        if (credentials.object.resource) {
            xmpp_creds.resource = credentials.object.resource;
        }
        return xmpp_creds;
    },

    parseXDataField: (field: XmppElement): XDataFieldResult | null => {
        const varAttr = field.attrs.var;
        if (!varAttr || varAttr === "FORM_TYPE") {
            return null;
        }

        const type = field.attrs.type || "text-single";
        const label = field.attrs.label;

        const values = field
            .getChildren("value")
            .map((v) => v.getText())
            .filter((t) => t !== undefined && t !== null);

        let value: string | number | boolean | string[] | null = null;
        if (type === "boolean") {
            if (values.length > 0) {
                const valStr = values[0].toLowerCase();
                value = valStr === "1" || valStr === "true";
            } else {
                value = false;
            }
        } else if (type === "text-multi" || type === "list-multi") {
            value = values;
        } else {
            if (values.length > 0) {
                const firstVal = values[0];
                if (type !== "list-single" && /^\d+$/.test(firstVal)) {
                    value = Number.parseInt(firstVal, 10);
                } else {
                    value = firstVal;
                }
            } else {
                value = null;
            }
        }

        const options = field.getChildren("option").map((opt) => {
            const optValEl = opt.getChild("value");
            const optVal = optValEl ? optValEl.getText() : "";
            return {
                label: opt.attrs.label || optVal,
                value: optVal,
            };
        });

        const fieldObj: XDataFieldResult["field"] = {
            type,
            ...(label && { label }),
            value,
            ...(options.length > 0 && { options }),
        };

        return {
            var: varAttr,
            field: fieldObj,
        };
    },
};
