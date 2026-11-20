/**
 * This is a platform for Sockethub implementing Web Push (RFC 8030), so a
 * web app with no backend of its own can notify its user while it is closed.
 *
 * The app encrypts each notification itself for its own subscription
 * (RFC 8291) and hands over the ciphertext with the subscription's delivery
 * URL. `send` signs a VAPID token (RFC 8292) and posts the ciphertext to that
 * URL. Sockethub never sees the content or the subscription's keys.
 *
 * Sending at a later time (`schedule`) is done by the server, which stores
 * the messages and submits each one here as an ordinary `send` when it is
 * due.
 */

import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSession,
} from "@sockethub/schemas";
import { toError } from "@sockethub/util/error";
import { createGuardedDispatcher } from "@sockethub/util/net";
import { fetch as undiciFetch } from "undici";
import {
    DEFAULT_TTL_SECONDS,
    MAX_CONTENT_BYTES,
    PlatformWebPushSchema,
} from "./schema";
import { Vapid, type VapidConfig } from "./vapid";

/**
 * The push services of the browser vendors. Without an allowlist the server
 * would post, with a signed token, to any URL a client names.
 */
export const DEFAULT_ALLOWED_HOSTS = [
    "*.push.apple.com",
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "*.notify.windows.com",
];
const DEFAULT_TIMEOUT_MS = 15000;
/** Push services answer with a status and at most a short reason. */
const MAX_RESPONSE_BYTES = 64 * 1024;

type WebPushConfig = PlatformConfig & {
    vapid?: Partial<VapidConfig>;
    allowedHosts?: Array<string>;
    timeoutMs?: number;
};

export type DeliveryStatus = "accepted" | "gone" | "retry" | "rejected";

/** `*.example.com` matches any subdomain; anything else must match exactly. */
export function hostAllowed(host: string, allowed: Array<string>): boolean {
    const name = host.toLowerCase();
    return allowed.some((entry) => {
        const pattern = entry.toLowerCase();
        return pattern.startsWith("*.")
            ? name.endsWith(pattern.slice(1)) &&
                  name.length > pattern.length - 1
            : name === pattern;
    });
}

/** How a push service's answer is reported (RFC 8030 section 5 and 7). */
export function statusFor(httpStatus: number): DeliveryStatus {
    if (httpStatus >= 200 && httpStatus < 300) return "accepted";
    if (httpStatus === 404 || httpStatus === 410) return "gone";
    if (httpStatus === 429 || httpStatus >= 500) return "retry";
    return "rejected";
}

/** `Retry-After` in seconds, from either of its two forms. */
export function retryAfterSeconds(
    header: string | null,
    now = Date.now(),
): number | undefined {
    if (!header) return undefined;
    const seconds = /^\d+$/.test(header.trim())
        ? Number(header)
        : Math.ceil((Date.parse(header) - now) / 1000);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

/** Enforce a deadline independently of a dependency's AbortSignal handling. */
function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`no response in ${timeoutMs}ms`)),
            timeoutMs,
        );
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

export default class WebPush implements PlatformInterface {
    private readonly log: Logger;
    private readonly fetchImpl: typeof undiciFetch = undiciFetch;
    private dispatcher?: ReturnType<typeof createGuardedDispatcher>;
    private vapid?: Vapid;
    config: PlatformConfig = { persist: false };

    constructor(session: PlatformSession) {
        this.log = session.log;
    }

    get schema() {
        return PlatformWebPushSchema;
    }

    isInitialized(): boolean {
        return true;
    }

    private get settings(): WebPushConfig {
        return this.config as WebPushConfig;
    }

    /** Created on the first job: packageConfig is applied after construction. */
    private getDispatcher(): ReturnType<typeof createGuardedDispatcher> {
        if (!this.dispatcher) {
            this.dispatcher = createGuardedDispatcher({
                allowPrivateAddresses:
                    this.config.allowPrivateAddresses === true,
                maxResponseBytes: MAX_RESPONSE_BYTES,
            });
        }
        return this.dispatcher;
    }

    /**
     * Post one encrypted message to the subscription in `target.id`. The job
     * completes with `object.status` for every answer a push service can
     * give, so a caller can tell "the subscription is gone" from "try again"
     * without parsing an error string. It only fails when the server itself
     * is misconfigured.
     */
    async send(job: ActivityStream, cb: PlatformCallback) {
        const done = (
            status: DeliveryStatus,
            extra: {
                httpStatus?: number;
                retryAfter?: number;
                detail?: string;
            },
        ) => {
            const result: ActivityStream = {
                type: "send",
                actor: job.actor,
                object: { type: "delivery", status, ...extra },
            } as ActivityStream;
            if (job.id) result.id = job.id;
            cb(null, result);
        };

        let vapid: Vapid;
        try {
            this.vapid ??= new Vapid(this.settings.vapid);
            vapid = this.vapid;
        } catch (err) {
            cb(toError(err));
            return;
        }

        let url: URL;
        try {
            url = new URL(String(job.target?.id));
        } catch {
            done("rejected", { detail: "target is not a valid URL" });
            return;
        }
        const secure =
            url.protocol === "https:" ||
            (url.protocol === "http:" &&
                this.config.allowInsecureHttp === true);
        const allowed = this.settings.allowedHosts ?? DEFAULT_ALLOWED_HOSTS;
        if (!secure || !hostAllowed(url.hostname, allowed)) {
            done("rejected", {
                detail: `${url.host} is not a push service this server sends to`,
            });
            return;
        }
        const object = job.object as {
            content: string;
            ttl?: number;
            urgency?: string;
            topic?: string;
        };
        const body = Buffer.from(object.content, "base64");
        if (body.length === 0 || body.length > MAX_CONTENT_BYTES) {
            done("rejected", {
                detail: `content must be 1 to ${MAX_CONTENT_BYTES} bytes`,
            });
            return;
        }

        const timeoutMs = this.settings.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        let res: Response;
        try {
            // withDeadline as well as the signal: undici requests in a
            // platform child have stayed pending after their signal fired.
            res = (await withDeadline(
                this.fetchImpl(url.href, {
                    method: "POST",
                    // A push service has no reason to redirect, and a
                    // redirect would leave the allowlisted host.
                    redirect: "manual",
                    dispatcher: this.getDispatcher(),
                    headers: {
                        authorization: vapid.authorization(url.origin),
                        "content-encoding": "aes128gcm",
                        "content-type": "application/octet-stream",
                        ttl: String(object.ttl ?? DEFAULT_TTL_SECONDS),
                        ...(object.urgency ? { urgency: object.urgency } : {}),
                        ...(object.topic ? { topic: object.topic } : {}),
                    },
                    body,
                    signal: AbortSignal.timeout(timeoutMs),
                } as Parameters<typeof undiciFetch>[1]),
                timeoutMs,
            )) as unknown as Response;
        } catch (err) {
            const error = toError(err);
            const cause = (error as { cause?: unknown }).cause;
            const reason =
                cause instanceof Error ? cause.message : error.message;
            // Only the host is logged: the rest of the URL is a secret.
            this.log.debug(`push to ${url.host} failed: ${reason}`);
            done("retry", { detail: reason });
            return;
        }

        const status = statusFor(res.status);
        // A refusal carries a short reason (Apple: `{"reason":"BadJwtToken"}`),
        // which is what an operator needs to fix a key or a contact address.
        const reason =
            status === "accepted"
                ? ""
                : (await res.text().catch(() => "")).trim().slice(0, 200);
        if (status === "accepted") {
            await res.body?.cancel().catch(() => undefined);
        }
        this.log.debug(`push to ${url.host}: HTTP ${res.status} (${status})`);
        const retryAfter =
            status === "retry"
                ? retryAfterSeconds(res.headers.get("retry-after"))
                : undefined;
        done(status, {
            httpStatus: res.status,
            ...(retryAfter !== undefined ? { retryAfter } : {}),
            ...(reason ? { detail: reason } : {}),
        });
    }

    /**
     * The server handles `schedule` before it reaches a platform. A job only
     * arrives here when scheduled delivery is turned off.
     */
    schedule(_job: ActivityStream, cb: PlatformCallback) {
        cb(new Error("scheduled delivery is not enabled on this server"));
    }

    cleanup(cb: PlatformCallback) {
        this.dispatcher?.close().catch(() => {});
        cb();
    }
}
