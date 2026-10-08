import { describe, expect, it } from "bun:test";

import { isBlockedAddress } from "./address.js";

describe("isBlockedAddress", () => {
    it("blocks IPv4 loopback (127.0.0.0/8)", () => {
        expect(isBlockedAddress("127.0.0.1")).toBe(true);
        expect(isBlockedAddress("127.255.255.254")).toBe(true);
    });

    it("blocks private IPv4 ranges", () => {
        expect(isBlockedAddress("10.0.0.1")).toBe(true);
        expect(isBlockedAddress("172.16.5.4")).toBe(true);
        expect(isBlockedAddress("172.31.255.255")).toBe(true);
        expect(isBlockedAddress("192.168.1.1")).toBe(true);
    });

    it("blocks link-local and metadata addresses", () => {
        expect(isBlockedAddress("169.254.1.1")).toBe(true);
        expect(isBlockedAddress("169.254.169.254")).toBe(true);
    });

    it("blocks 0.0.0.0 and carrier-grade NAT", () => {
        expect(isBlockedAddress("0.0.0.0")).toBe(true);
        expect(isBlockedAddress("100.64.0.1")).toBe(true);
        expect(isBlockedAddress("100.127.255.255")).toBe(true);
    });

    it("blocks IPv6 loopback and unique/link-local", () => {
        expect(isBlockedAddress("::1")).toBe(true);
        expect(isBlockedAddress("fc00::1")).toBe(true);
        expect(isBlockedAddress("fd12:3456::1")).toBe(true);
        expect(isBlockedAddress("fe80::1")).toBe(true);
    });

    it("blocks IPv4-mapped IPv6 private addresses in every spelling", () => {
        expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
        expect(isBlockedAddress("::ffff:7f00:1")).toBe(true);
        expect(isBlockedAddress("0:0:0:0:0:ffff:7f00:1")).toBe(true);
        expect(isBlockedAddress("::FFFF:7F00:1")).toBe(true);
        expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    });

    it("blocks IPv4-compatible and NAT64 embeddings", () => {
        expect(isBlockedAddress("::7f00:1")).toBe(true);
        expect(isBlockedAddress("64:ff9b::7f00:1")).toBe(true);
    });

    it("blocks local-use NAT64 embeddings of private IPv4 addresses", () => {
        // RFC 6052 §2.2 /48 layout under the RFC 8215 prefix 64:ff9b:1::/48.
        // 10.0.0.1 → 64:ff9b:1:a00:0:100::
        // 127.0.0.1 → 64:ff9b:1:7f00:0:100::
        // 192.168.0.1 → 64:ff9b:1:c0a8:0:100::
        // 172.16.5.1 → 64:ff9b:1:ac10:5:100::
        // 169.254.169.254 → 64:ff9b:1:a9fe:a9:fe00::
        // 100.100.100.200 → 64:ff9b:1:6464:64:c800::
        expect(isBlockedAddress("64:ff9b:1:a00:0:100::")).toBe(true);
        expect(isBlockedAddress("64:ff9b:1:7f00:0:100::")).toBe(true);
        expect(isBlockedAddress("64:ff9b:1:c0a8:0:100::")).toBe(true);
        expect(isBlockedAddress("64:ff9b:1:ac10:5:100::")).toBe(true);
        expect(isBlockedAddress("64:ff9b:1:a9fe:a9:fe00::")).toBe(true);
        expect(isBlockedAddress("64:FF9B:1:A9FE:A9:FE00::")).toBe(true);
        // A non-zero suffix is still translated (RFC 6052 §2.2).
        expect(isBlockedAddress("64:ff9b:1:a9fe:a9:fe00::1")).toBe(true);
        expect(isBlockedAddress("64:ff9b:1:6464:64:c800::")).toBe(true);
    });

    it("blocks the whole local-use NAT64 prefix at every RFC 6052 length", () => {
        // /56 prefix 64:ff9b:1:100::/56 → 169.254.169.254. A /48 misread is
        // the public address 1.169.254.169.
        expect(isBlockedAddress("64:ff9b:1:1a9:fe:a9fe::")).toBe(true);
        // /56 → 10.0.0.1 and 127.0.0.1, with public /48 misreads.
        expect(isBlockedAddress("64:ff9b:1:10a:0:1::")).toBe(true);
        expect(isBlockedAddress("64:ff9b:1:17f:0:1::")).toBe(true);
        // /64 prefix 64:ff9b:1:808::/64. IPv4 starts after the u octet
        // (bits 72–103), not at bit 64.
        expect(isBlockedAddress("64:ff9b:1:808:a9:fea9:fe00::")).toBe(true);
        expect(isBlockedAddress("64:ff9b:1:808:7f:0:100::")).toBe(true);
        expect(isBlockedAddress("64:ff9b:1:808:a:0:100::")).toBe(true);
        // /96 prefix 64:ff9b:1:808:8:800::/96 → 169.254.169.254.
        expect(isBlockedAddress("64:ff9b:1:808:8:800:a9fe:a9fe")).toBe(true);
        // /96 embedding of 0.0.0.0 (64:ff9b:1:fffe::/96). The /48 misread
        // is public 255.254.0.0.
        expect(isBlockedAddress("64:ff9b:1:fffe::")).toBe(true);
        // A public IPv4 under this prefix is still local-use, not global.
        expect(isBlockedAddress("64:ff9b:1:808:8:800::")).toBe(true);
    });

    it("blocks unparseable literals conservatively", () => {
        expect(isBlockedAddress("not-an-ip")).toBe(true);
        expect(isBlockedAddress("999.1.1.1")).toBe(true);
    });

    it("does not block representative public addresses", () => {
        expect(isBlockedAddress("8.8.8.8")).toBe(false);
        expect(isBlockedAddress("1.1.1.1")).toBe(false);
        expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
        expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(false);
        expect(isBlockedAddress("64:ff9b::8.8.8.8")).toBe(false);
    });
});
