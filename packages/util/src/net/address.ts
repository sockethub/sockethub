/**
 * IP address classification for SSRF defense. Used to decide whether a server
 * fetching client-supplied URLs may connect to a given resolved address.
 */

/**
 * Returns true if `ip` is a loopback, private, link-local, or otherwise
 * non-public address that should not be reachable by a server fetching
 * client-supplied URLs (SSRF defense). Handles IPv4, IPv6, and IPv4-mapped
 * IPv6 addresses.
 */
export function isBlockedAddress(ip: string): boolean {
    const addr = ip.trim().toLowerCase();

    if (addr.includes(":")) {
        return isBlockedIpv6(addr);
    }

    return isBlockedIpv4(addr);
}

function isBlockedIpv4(ip: string): boolean {
    const parts = ip.split(".").map((p) => Number(p));
    if (
        parts.length !== 4 ||
        parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
    ) {
        // Not a parseable IPv4 literal; block conservatively.
        return true;
    }
    const [a, b] = parts;
    // 0.0.0.0/8 ("this network", commonly routes to localhost)
    if (a === 0) return true;
    // 127.0.0.0/8 loopback
    if (a === 127) return true;
    // 10.0.0.0/8 private
    if (a === 10) return true;
    // 172.16.0.0/12 private
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 private
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 link-local (incl. 169.254.169.254 cloud metadata)
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 carrier-grade NAT shared address space
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
}

/**
 * Expand an IPv6 literal (lowercased, zone index already stripped) to its
 * eight 16-bit groups, or null if unparseable. A trailing dotted-quad
 * (e.g. ::ffff:127.0.0.1) is converted to two hex groups first, so every
 * notation of the same address normalizes identically.
 */
function expandIpv6(address: string): Array<number> | null {
    let addr = address;
    const dotted = addr.match(/^(.+:)(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (dotted) {
        const octets = dotted[2].split(".").map(Number);
        if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
            return null;
        }
        const hi = ((octets[0] << 8) | octets[1]).toString(16);
        const lo = ((octets[2] << 8) | octets[3]).toString(16);
        addr = `${dotted[1]}${hi}:${lo}`;
    }

    const halves = addr.split("::");
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(":") : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
    if (halves.length === 2 ? head.length + tail.length > 8 : head.length !== 8)
        return null;
    const groupsStr =
        halves.length === 2
            ? [
                  ...head,
                  ...new Array(8 - head.length - tail.length).fill("0"),
                  ...tail,
              ]
            : head;

    const groups: Array<number> = [];
    for (const group of groupsStr) {
        if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
        groups.push(Number.parseInt(group, 16));
    }
    return groups;
}

/**
 * If the expanded IPv6 groups embed an IPv4 address — IPv4-mapped
 * (::ffff:0:0/96), deprecated IPv4-compatible (::/96, which also covers
 * `::`/`::1`), or the NAT64 well-known prefix (64:ff9b::/96) — return it in
 * dotted-quad form so IPv4 rules apply; otherwise return null.
 */
function extractEmbeddedIpv4(groups: Array<number>): string | null {
    const [a, b, c, d, e, f, g, h] = groups;
    const zeroPrefix = a === 0 && b === 0 && c === 0 && d === 0 && e === 0;
    const mapped = zeroPrefix && f === 0xffff;
    const compat = zeroPrefix && f === 0;
    const nat64 =
        a === 0x64 && b === 0xff9b && c === 0 && d === 0 && e === 0 && f === 0;
    if (!mapped && !compat && !nat64) return null;
    return `${g >> 8}.${g & 0xff}.${h >> 8}.${h & 0xff}`;
}

/**
 * True when `groups` fall under the RFC 8215 local-use NAT64 prefix
 * `64:ff9b:1::/48`.
 */
function isLocalUseNat64(groups: Array<number>): boolean {
    const [a, b, c] = groups;
    return a === 0x64 && b === 0xff9b && c === 0x0001;
}

/** RFC 6052 §2.2 /48 layout: IPv4 spans groups d–f with an ignored u-octet. */
function extractIpv4At48(groups: Array<number>): string {
    const [, , , d, e, f] = groups;
    return `${d >> 8}.${d & 0xff}.${e & 0xff}.${f >> 8}`;
}

/** RFC 6052 §2.2 /64 layout: IPv4 in groups e–f after a 64-bit prefix. */
function extractIpv4At64(groups: Array<number>): string {
    const [, , , , e, f] = groups;
    return `${e >> 8}.${e & 0xff}.${f >> 8}.${f & 0xff}`;
}

/** RFC 6052 §2.2 /96 layout: IPv4 in the last 32 bits (groups g–h). */
function extractIpv4At96(groups: Array<number>): string {
    const [, , , , , , g, h] = groups;
    return `${g >> 8}.${g & 0xff}.${h >> 8}.${h & 0xff}`;
}

/**
 * Whether a local-use NAT64 address could reach a blocked IPv4 target.
 *
 * RFC 8215 allocates `64:ff9b:1::/48` for site-local translators, but
 * deployments may use more-specific RFC 6052 prefix lengths (/48, /64, /96).
 * Without knowing the configured length, try every layout that the address
 * bit pattern can plausibly represent and block when any decode is private.
 */
function isBlockedLocalNat64(groups: Array<number>): boolean {
    if (!isLocalUseNat64(groups)) return false;

    const [, , , , e, , g, h] = groups;

    if (isBlockedIpv4(extractIpv4At48(groups))) return true;

    // /96 sub-prefix: suffix holds the IPv4 (e.g. 64:ff9b:1:808:8:800:a9fe:a9fe).
    if (g !== 0 || h !== 0) {
        if (isBlockedIpv4(extractIpv4At96(groups))) return true;
    }

    // /64 sub-prefix: IPv4 in e–f when e's high byte is part of the address
    // rather than the /48 u-octet (e.g. 64:ff9b:1:808:a9fe:a9fe).
    if (e >> 8 !== 0) {
        if (isBlockedIpv4(extractIpv4At64(groups))) return true;
    }

    return false;
}

function isBlockedIpv6(ip: string): boolean {
    // Strip zone index (e.g. fe80::1%eth0).
    const addr = ip.split("%")[0];
    // Normalize to 8 groups so hex/dotted/compressed/uppercase spellings of
    // the same address are classified identically (e.g. ::ffff:7f00:1 and
    // ::ffff:127.0.0.1 are both IPv4-mapped loopback).
    const groups = expandIpv6(addr);
    if (!groups) {
        // Not a parseable IPv6 literal; block conservatively.
        return true;
    }
    // Embedded IPv4 (mapped, compatible, or the NAT64 well-known prefix) ->
    // apply IPv4 rules. This also covers :: (0.0.0.0) and ::1 (0.0.0.1),
    // both within blocked 0.0.0.0/8.
    const embedded = extractEmbeddedIpv4(groups);
    if (embedded) {
        return isBlockedIpv4(embedded);
    }
    // Local-use NAT64 may embed IPv4 at /48, /64, or /96 per RFC 6052 §2.2.
    if (isBlockedLocalNat64(groups)) {
        return true;
    }
    // fc00::/7 unique-local.
    if ((groups[0] & 0xfe00) === 0xfc00) return true;
    // fe80::/10 link-local.
    if ((groups[0] & 0xffc0) === 0xfe80) return true;
    return false;
}
