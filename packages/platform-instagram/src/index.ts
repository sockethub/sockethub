import type {
    ActivityStream,
    CredentialsObject,
    Logger,
    PlatformCallback,
    PlatformInterface,
    PlatformSession,
    StatelessPlatformConfig,
} from "@sockethub/schemas";
import { PlatformInstagramSchema } from "./schema.js";

export interface InstagramCredentials extends CredentialsObject {
    object: {
        type: "credentials";
        token: string;
        apiVersion: string;
        login?: "instagram" | "facebook";
        pageId?: string;
    };
}

const MAX_TEXT_BYTES = 1000;

export default class Instagram implements PlatformInterface {
    private readonly log: Logger;
    config: StatelessPlatformConfig = {
        persist: false,
        requireCredentials: ["send"],
    };

    constructor(session: PlatformSession) {
        this.log = session.log;
    }

    get schema() {
        return PlatformInstagramSchema;
    }

    isInitialized(): boolean {
        return true;
    }

    cleanup(done: PlatformCallback): void {
        done();
    }

    async send(
        job: ActivityStream,
        credentials: InstagramCredentials,
        done: PlatformCallback,
    ): Promise<void> {
        const { token, apiVersion, login, pageId } = credentials.object;
        const facebookLogin = login === "facebook";
        const host = facebookLogin
            ? "graph.facebook.com"
            : "graph.instagram.com";
        const accountId = facebookLogin ? pageId : job.actor.id;
        const humanAgent = job.object.humanAgent === true;
        let result: ActivityStream;
        try {
            // Meta limits Instagram text to 1000 UTF-8 bytes; the schema's
            // maxLength counts code points, so multi-byte text needs this check.
            const bytes = new TextEncoder().encode(job.object.content).length;
            if (bytes > MAX_TEXT_BYTES) {
                throw new Error(
                    `instagram: message text is ${bytes} UTF-8 bytes; Meta allows at most ${MAX_TEXT_BYTES}`,
                );
            }
            const response = await fetch(
                `https://${host}/${apiVersion}/${encodeURIComponent(accountId)}/messages`,
                {
                    method: "POST",
                    redirect: "error",
                    headers: {
                        authorization: `Bearer ${token}`,
                        "content-type": "application/json",
                    },
                    body: JSON.stringify({
                        recipient: { id: job.target.id },
                        message: { text: job.object.content },

                        ...(facebookLogin
                            ? {
                                  messaging_type: humanAgent
                                      ? "MESSAGE_TAG"
                                      : "RESPONSE",
                              }
                            : {}),
                        ...(humanAgent
                            ? {
                                  tag: facebookLogin
                                      ? "HUMAN_AGENT"
                                      : "human_agent",
                              }
                            : {}),
                    }),
                    signal: AbortSignal.timeout(15_000),
                },
            );
            const data: unknown = await response.json();
            if (!data || typeof data !== "object") {
                throw new Error("instagram: invalid API response");
            }
            if ("error" in data || !response.ok) {
                const error = "error" in data ? data.error : undefined;
                let detail = `HTTP ${response.status}`;
                if (error && typeof error === "object") {
                    if ("code" in error && typeof error.code === "number") {
                        detail += `, code ${error.code}`;
                    }
                    if (
                        "error_subcode" in error &&
                        typeof error.error_subcode === "number"
                    ) {
                        detail += `, subcode ${error.error_subcode}`;
                    }
                    if (
                        "message" in error &&
                        typeof error.message === "string"
                    ) {
                        detail += `: ${error.message.split(token).join("[redacted]")}`;
                    }
                }
                const windowClosed =
                    error &&
                    typeof error === "object" &&
                    "code" in error &&
                    error.code === 10 &&
                    "error_subcode" in error &&
                    (error.error_subcode === 2018278 ||
                        error.error_subcode === 2534022);
                const reason = windowClosed
                    ? "meta:messaging-window-closed"
                    : "instagram: send rejected";
                throw new Error(`${reason} (${detail})`);
            }
            if (
                !("message_id" in data) ||
                typeof data.message_id !== "string" ||
                !data.message_id
            ) {
                throw new Error("instagram: API response missing message_id");
            }
            result = {
                ...job,
                object: { ...job.object, id: data.message_id },
            };
        } catch (error) {
            // Network errors may contain request details; never expose tokens.
            const failure =
                error instanceof Error &&
                (error.message.startsWith("instagram:") ||
                    error.message.startsWith("meta:messaging-window-closed"))
                    ? new Error(error.message.split(token).join("[redacted]"))
                    : new Error(
                          "instagram: send failed (network error, timeout, or invalid JSON); delivery is unknown",
                      );
            this.log.warn(`send failed for actor ${job.actor.id} on instagram`);
            done(failure);
            return;
        }
        done(null, result);
    }
}
