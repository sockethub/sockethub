import { createLogger } from "@sockethub/logger";
import type { Socket } from "socket.io";

const log = createLogger("server:rate-limiter");

interface RateLimitConfig {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
    blockDurationMs: number; // How long to block after exceeding limit
}

interface ClientState {
    count: number;
    windowStart: number;
    blocked: boolean;
    blockedUntil: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
    windowMs: 1000, // 1 second window
    maxRequests: 100, // 100 messages per second per client
    blockDurationMs: 5000, // Block for 5 seconds if exceeded
};

// Cleanup thresholds
const STALE_ENTRY_THRESHOLD_MS = 60000; // 60 seconds
const CLEANUP_INTERVAL_MS = 30000; // 30 seconds

const clientStates = new Map<string, ClientState>();

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
let cleanupIntervalRunning = false;

// Cleanup stale entries periodically
function startCleanup() {
    if (cleanupIntervalRunning) {
        return;
    }
    cleanupIntervalRunning = true;
    cleanupIntervalId = setInterval(() => {
        const now = Date.now();
        for (const [socketId, state] of clientStates.entries()) {
            // Remove entries that haven't been active for 60 seconds
            if (now - state.windowStart > STALE_ENTRY_THRESHOLD_MS) {
                clientStates.delete(socketId);
            }
        }
    }, CLEANUP_INTERVAL_MS);
}

export function stopCleanup() {
    if (cleanupIntervalId !== null) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        cleanupIntervalRunning = false;
    }
}

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Start the cleanup interval when the rate limiter is created
    startCleanup();

    return function rateLimitMiddleware(
        socket: Socket,
        _eventName: string,
        next: (err?: Error) => void,
    ) {
        const now = Date.now();
        let state = clientStates.get(socket.id);

        if (!state) {
            state = {
                count: 0,
                windowStart: now,
                blocked: false,
                blockedUntil: 0,
            };
            clientStates.set(socket.id, state);
        }

        // Check if currently blocked
        if (state.blocked) {
            if (now < state.blockedUntil) {
                // Still blocked, drop and log for debugging
                log.debug(
                    `dropping event for blocked socket ${socket.id}; blocked until ${new Date(
                        state.blockedUntil,
                    ).toISOString()}`,
                );
                const error = new Error("Rate limit exceeded");
                next(error);
                return;
            }
            // Block expired, reset
            state.blocked = false;
            state.count = 0;
            state.windowStart = now;
        }

        // Reset window if expired
        if (now - state.windowStart > cfg.windowMs) {
            state.count = 0;
            state.windowStart = now;
        }

        state.count++;

        if (state.count > cfg.maxRequests) {
            state.blocked = true;
            state.blockedUntil = now + cfg.blockDurationMs;
            log.warn(
                `rate limit exceeded for ${socket.id}: ${state.count} requests in ${cfg.windowMs}ms, blocking for ${cfg.blockDurationMs}ms`,
            );
            socket.emit("error", {
                type: "Error",
                "@context": [
                    "https://www.w3.org/ns/activitystreams",
                    "https://sockethub.org/ns/context/v1.jsonld",
                    "https://sockethub.org/ns/context/platform/error/v1.jsonld",
                ],
                actor: {
                    type: "Application",
                    name: "sockethub-server",
                },
                summary: "rate limit exceeded, temporarily blocked",
            });
            const error = new Error("Rate limit exceeded");
            next(error);
            return;
        }

        next();
    };
}

export function cleanupClient(socketId: string) {
    clientStates.delete(socketId);
}
