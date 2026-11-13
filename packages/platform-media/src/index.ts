/**
 * This is a platform for Sockethub implementing media downloads. Only images
 * are supported for now.
 *
 * A browser can display an image from another origin, but it can only read
 * the bytes when that host sends CORS headers, so it cannot store a copy.
 * `download` fetches the image on the client's behalf and returns its bytes.
 *
 * It is its own platform, not a verb on the metadata platform, so slow or
 * large downloads run in their own process and job queue and never take the
 * slots link previews need.
 */

import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSession,
} from "@sockethub/schemas";
import { markExpectedError, toError } from "@sockethub/util/error";
import { createGuardedDispatcher, redactUrl } from "@sockethub/util/net";
import { fetch as undiciFetch } from "undici";
import packageJson from "../package.json" with { type: "json" };
import {
    DEFAULT_DOWNLOAD_CONCURRENCY,
    DOWNLOAD_IMAGE_TYPES,
    readCapped,
    resolveDownloadConfig,
    sniffImageType,
    TooLargeError,
} from "./download";
import { PlatformMediaSchema } from "./schema";

/** Override per deployment via `packageConfig.userAgent`. */
const DEFAULT_USER_AGENT = `Mozilla/5.0 (compatible; SockethubBot/${packageJson.version}; +https://sockethub.org)`;

/** undici wraps network failures as "fetch failed" with the reason as `cause`. */
function errorCause(err: Error): Error & { code?: string } {
    const cause = (err as { cause?: unknown }).cause;
    return cause instanceof Error ? cause : err;
}

/** Enforce a deadline independently of a dependency's AbortSignal handling. */
function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () =>
                reject(
                    Object.assign(
                        new Error(`download timed out after ${timeoutMs}ms`),
                        { name: "TimeoutError" },
                    ),
                ),
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

export default class Media implements PlatformInterface {
    private readonly log: Logger;
    private readonly fetchImpl = undiciFetch;
    private dispatcher?: ReturnType<typeof createGuardedDispatcher>;
    config: PlatformConfig = {
        persist: false,
        // Each job can hold maxBytes several times over in memory, so run
        // fewer at once than the stateless default.
        concurrency: DEFAULT_DOWNLOAD_CONCURRENCY,
    };

    constructor(session: PlatformSession) {
        this.log = session.log;
    }

    get schema() {
        return PlatformMediaSchema;
    }

    isInitialized(): boolean {
        return true;
    }

    /**
     * The SSRF-guarded dispatcher, created on the first job (its settings
     * come from packageConfig, fixed by then) and reused so connections are
     * pooled. It also aborts any response over `maxBytes`.
     */
    private getDispatcher(
        maxBytes: number,
    ): ReturnType<typeof createGuardedDispatcher> {
        if (!this.dispatcher) {
            this.dispatcher = createGuardedDispatcher({
                allowPrivateAddresses:
                    this.config.allowPrivateAddresses === true,
                maxResponseBytes: maxBytes,
            });
        }
        return this.dispatcher;
    }

    private userAgent(): string {
        return typeof this.config.userAgent === "string" &&
            this.config.userAgent
            ? this.config.userAgent
            : DEFAULT_USER_AGENT;
    }

    /**
     * Return an image's bytes (base64) and real type. `object.url` may be
     * relative to the page in `actor.id`; the page's origin is sent as
     * `Referer`, as a browser would.
     */
    async download(job: ActivityStream, cb: PlatformCallback) {
        const fail = (code: string, url: string, detail: string) =>
            cb(
                markExpectedError(
                    new Error(
                        `image download failed (${code}) for ${redactUrl(url)}: ${detail}`,
                    ),
                ),
            );
        const requested = String(
            (job.object as { url?: unknown } | undefined)?.url ?? "",
        );
        const config = resolveDownloadConfig(this.config);
        let url: URL;
        let referer: string | undefined;
        try {
            const page = new URL(job.actor.id);
            if (page.protocol === "http:" || page.protocol === "https:") {
                referer = `${page.origin}/`;
            }
            url = new URL(requested, page);
        } catch {
            try {
                url = new URL(requested);
            } catch {
                fail("invalid-url", requested, "not a valid URL");
                return;
            }
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            fail("invalid-url", requested, "only http(s) URLs can be fetched");
            return;
        }
        this.log.debug(`downloading ${redactUrl(url.href)}`);

        const accept = [...config.types]
            .map((type) => DOWNLOAD_IMAGE_TYPES[type])
            .join(",");
        // withDeadline as well as the signal: undici requests in a platform
        // child have stayed pending after their signal fired.
        const deadline = Date.now() + config.timeoutMs;
        let res: Response;
        try {
            res = (await withDeadline(
                this.fetchImpl(url.href, {
                    dispatcher: this.getDispatcher(config.maxBytes),
                    headers: {
                        accept,
                        "user-agent": this.userAgent(),
                        ...(referer ? { referer } : {}),
                    },
                    signal: AbortSignal.timeout(config.timeoutMs),
                } as RequestInit & {
                    dispatcher: ReturnType<typeof createGuardedDispatcher>;
                }),
                config.timeoutMs,
            )) as unknown as Response;
        } catch (err) {
            const error = toError(err);
            if (error.name === "TimeoutError") {
                fail(
                    "timeout",
                    url.href,
                    `no response in ${config.timeoutMs}ms`,
                );
            } else {
                fail("fetch-failed", url.href, errorCause(error).message);
            }
            return;
        }
        if (!res.ok) {
            await res.body?.cancel().catch(() => undefined);
            const code =
                res.status === 404 || res.status === 410
                    ? "not-found"
                    : [401, 403, 429, 451].includes(res.status)
                      ? "origin-refused"
                      : "origin-error";
            fail(code, url.href, `HTTP ${res.status}`);
            return;
        }
        const finalUrl = res.url || url.href;
        const declaredLength = Number(res.headers.get("content-length"));
        if (declaredLength > config.maxBytes) {
            await res.body?.cancel().catch(() => undefined);
            fail(
                "too-large",
                finalUrl,
                `image is ${declaredLength} bytes; the limit is ${config.maxBytes}`,
            );
            return;
        }
        let bytes: Uint8Array;
        try {
            bytes = await withDeadline(
                readCapped(res.body, config.maxBytes),
                Math.max(1, deadline - Date.now()),
            );
        } catch (err) {
            const error = toError(err);
            if (
                error instanceof TooLargeError ||
                errorCause(error).code === "UND_ERR_RES_EXCEEDED_MAX_SIZE"
            ) {
                fail(
                    "too-large",
                    finalUrl,
                    `image is larger than ${config.maxBytes} bytes`,
                );
            } else if (error.name === "TimeoutError") {
                fail(
                    "timeout",
                    finalUrl,
                    `not received in ${config.timeoutMs}ms`,
                );
            } else {
                fail("fetch-failed", finalUrl, errorCause(error).message);
            }
            return;
        }
        const type = sniffImageType(bytes);
        if (!type || !config.types.has(type)) {
            const served =
                res.headers.get("content-type")?.split(";", 1)[0].trim() ||
                "no content type";
            fail(
                "not-image",
                finalUrl,
                type
                    ? `${type} images are not allowed on this server`
                    : `response is not a supported image (served as ${served})`,
            );
            return;
        }
        job.object = {
            type: "image",
            url: finalUrl,
            mediaType: DOWNLOAD_IMAGE_TYPES[type],
            size: bytes.byteLength,
            data: Buffer.from(bytes).toString("base64"),
        };
        cb(null, job);
    }

    cleanup(cb: PlatformCallback) {
        // Release the guarded dispatcher's pooled connections on shutdown.
        this.dispatcher?.close().catch(() => {});
        cb();
    }
}
