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
    object: { type: "credentials"; token: string; apiVersion: string };
}

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
        const { token, apiVersion } = credentials.object;
        const humanAgent = job.object.humanAgent === true;
        let result: ActivityStream;
        try {
            const response = await fetch(
                `https://graph.instagram.com/${apiVersion}/${encodeURIComponent(job.actor.id)}/messages`,
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

                        ...(humanAgent ? { tag: "human_agent" } : {}),
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
                throw new Error(`instagram: send rejected (${detail})`);
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
                error instanceof Error && error.message.startsWith("instagram:")
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
