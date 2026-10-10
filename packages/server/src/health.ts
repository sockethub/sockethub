/**
 * `GET /health` for load balancers and monitors: 200 when the shared Redis
 * connection answers a PING, 503 otherwise. Unauthenticated and content-free
 * beyond the verdict, so it leaks nothing an operator would not want public.
 */
import { setTimeout as sleep } from "node:timers/promises";
import {
    createCredentialsRedisConnection,
    type RedisConfig,
} from "@sockethub/data-layer";
import type { Express, Request, Response } from "express";
import config from "./config.js";

export const HEALTH_PATH = "/health";
const PING_TIMEOUT_MS = 2000;

export type HealthDependencies = {
    ping?: () => Promise<unknown>;
};

export async function checkHealth(ping: () => Promise<unknown>) {
    try {
        await Promise.race([
            ping(),
            sleep(PING_TIMEOUT_MS).then(() => {
                throw new Error("redis ping timed out");
            }),
        ]);
        return { status: "ok", redis: "ok" } as const;
    } catch {
        return { status: "error", redis: "error" } as const;
    }
}

export function registerHealthRoute(
    app: Express,
    deps: HealthDependencies = {},
) {
    const ping =
        deps.ping ??
        (() =>
            createCredentialsRedisConnection(
                config.get("redis") as RedisConfig,
            ).ping());
    app.get(HEALTH_PATH, async (_req: Request, res: Response) => {
        const health = await checkHealth(ping);
        res.setHeader("Cache-Control", "no-store");
        res.status(health.status === "ok" ? 200 : 503).json(health);
    });
}
