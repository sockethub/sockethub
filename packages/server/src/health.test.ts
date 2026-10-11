import { describe, expect, it } from "bun:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { HEALTH_PATH, registerHealthRoute } from "./health.js";

async function get(ping: () => Promise<unknown>) {
    const app = express();
    registerHealthRoute(app, { ping });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    try {
        const res = await fetch(`http://127.0.0.1:${port}${HEALTH_PATH}`);
        return { status: res.status, body: await res.json() };
    } finally {
        server.close();
    }
}

describe("GET /health", () => {
    it("returns 200 when redis answers", async () => {
        const res = await get(async () => "PONG");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok", redis: "ok" });
    });

    it("returns 503 when redis fails", async () => {
        const res = await get(async () => {
            throw new Error("ECONNREFUSED");
        });
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ status: "error", redis: "error" });
    });
});
