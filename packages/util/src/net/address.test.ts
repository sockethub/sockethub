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
