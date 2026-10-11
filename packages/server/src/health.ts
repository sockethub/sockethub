/**
 * `GET /health` for load balancers and monitors: 200 when the shared Redis
 * connection answers a PING, 503 otherwise. Unauthenticated and content-free
 * beyond the verdict, so it leaks nothing an operator would not want public.
 */
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            ping(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("redis ping timed out")),
                    PING_TIMEOUT_MS,
                );
            }),
        ]);
        return { status: "ok", redis: "ok" } as const;
    } catch {
        return { status: "error", redis: "error" } as const;
    } finally {
        if (timer !== undefined) clearTimeout(timer);
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
