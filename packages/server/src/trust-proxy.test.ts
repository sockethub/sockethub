import { describe, expect, it } from "bun:test";

import type { IncomingMessage } from "node:http";
import express from "express";

import { getRequestClientIp, resolveTrustProxy } from "./trust-proxy.js";

describe("resolveTrustProxy", () => {
    it("trusts nothing by default", () => {
        expect(resolveTrustProxy(false, "socket")).toBe(false);
    });

    it("passes through an explicit hop count", () => {
        expect(resolveTrustProxy(2, "socket")).toBe(2);
    });

    it("passes through a subnet or preset", () => {
        expect(resolveTrustProxy("loopback", "socket")).toBe("loopback");
        expect(resolveTrustProxy("10.0.0.0/8", "socket")).toBe("10.0.0.0/8");
    });

    it("reads boolean strings from the environment as booleans", () => {
        // Express would otherwise treat "true" as a subnet name.
        expect(resolveTrustProxy("true", "socket")).toBe(true);
        expect(resolveTrustProxy("false", "socket")).toBe(false);
    });

    it("reads a numeric string as a hop count", () => {
        expect(resolveTrustProxy("3", "socket")).toBe(3);
    });

    it("treats an empty or non-scalar value as no trust", () => {
        expect(resolveTrustProxy("", "socket")).toBe(false);
        expect(resolveTrustProxy("   ", "socket")).toBe(false);
        expect(resolveTrustProxy(undefined, "socket")).toBe(false);
        expect(resolveTrustProxy(null, "socket")).toBe(false);
        expect(resolveTrustProxy({}, "socket")).toBe(false);
    });

    it("follows reconnectIpSource=proxy when otherwise unset", () => {
        // Declaring the socket path trusts the forwarded header but leaving
        // the HTTP path distrusting it is never what an operator means: it
        // collapses every proxied request into one rate-limit bucket.
        expect(resolveTrustProxy(false, "proxy")).toBe(1);
        expect(resolveTrustProxy(undefined, "proxy")).toBe(1);
        expect(resolveTrustProxy("", "proxy")).toBe(1);
    });

    it("keeps an explicit setting when reconnectIpSource is proxy", () => {
        expect(resolveTrustProxy(2, "proxy")).toBe(2);
        expect(resolveTrustProxy("loopback", "proxy")).toBe("loopback");
        expect(resolveTrustProxy(true, "proxy")).toBe(true);
    });

    it("follows an explicit x-forwarded-for proxyHeader", () => {
        expect(resolveTrustProxy(false, "proxy", "x-forwarded-for")).toBe(1);
        expect(resolveTrustProxy(false, "proxy", "X-Forwarded-For")).toBe(1);
        expect(resolveTrustProxy(false, "proxy", "  x-forwarded-for ")).toBe(1);
        expect(resolveTrustProxy(false, "proxy", "")).toBe(1);
        expect(resolveTrustProxy(false, "proxy", undefined)).toBe(1);
    });

    it("does not auto-trust when a custom proxyHeader is configured", () => {
        // The operator vouched for that header alone. Their proxy may leave
        // x-forwarded-for — the only header Express reads — client-settable,
        // which would hand clients control of their rate-limit identity.
        expect(resolveTrustProxy(false, "proxy", "cf-connecting-ip")).toBe(
            false,
        );
        expect(resolveTrustProxy(undefined, "proxy", "x-real-ip")).toBe(false);
    });

    it("still honors an explicit setting with a custom proxyHeader", () => {
        expect(resolveTrustProxy(1, "proxy", "cf-connecting-ip")).toBe(1);
        expect(resolveTrustProxy("loopback", "proxy", "x-real-ip")).toBe(
            "loopback",
        );
    });
});


describe("socket admission IP", () => {
    it("matches Express HTTP identity across proxy policies", () => {
        for (const trust of [false, true, 1, 2, "loopback"]) {
            const app = express();
            app.set("trust proxy", resolveTrustProxy(trust, "socket"));
            const request = {
                socket: { remoteAddress: "::ffff:127.0.0.1" },
                headers: { "x-forwarded-for": "192.0.2.1, 198.51.100.2" },
            } as IncomingMessage;
            const httpRequest = Object.assign(Object.create(app.request), request, {
                app,
            });
            const socketIp = getRequestClientIp(request, app);
            const httpIp = httpRequest.ip.replace(/^::ffff:/, "");
            expect(socketIp).toBe(httpIp);
            expect(socketIp).toBe(trust === false ? "127.0.0.1" : trust === 1 || trust === "loopback" ? "198.51.100.2" : "192.0.2.1");
        }
    });
});
