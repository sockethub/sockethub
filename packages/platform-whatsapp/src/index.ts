import type {
    ActivityStream,
    CredentialsObject,
    Logger,
    PlatformCallback,
    PlatformInterface,
    PlatformSession,
    StatelessPlatformConfig,
} from "@sockethub/schemas";
import { PlatformWhatsAppSchema } from "./schema.js";

export interface WhatsAppCredentials extends CredentialsObject {
    object: { type: "credentials"; token: string; apiVersion: string };
}

export default class WhatsApp implements PlatformInterface {
    private readonly log: Logger;
    config: StatelessPlatformConfig = {
        persist: false,
        requireCredentials: ["send"],
    };

    constructor(session: PlatformSession) {
        this.log = session.log;
    }

    get schema() {
        return PlatformWhatsAppSchema;
    }

    isInitialized(): boolean {
        return true;
    }

    cleanup(done: PlatformCallback): void {
        done();
    }

    async send(
        job: ActivityStream,
        credentials: WhatsAppCredentials,
        done: PlatformCallback,
    ): Promise<void> {
        const { token, apiVersion } = credentials.object;
        let result: ActivityStream;
        try {
            const response = await fetch(
                `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(job.actor.id)}/messages`,
                {
                    method: "POST",
                    redirect: "error",
                    headers: {
                        authorization: `Bearer ${token}`,
                        "content-type": "application/json",
                    },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        recipient_type: "individual",
                        // Digits-only E.164 is valid input, but Meta prepends the
                        // business number's country calling code when `to` has no
                        // leading "+", which misdelivers the message.
                        to: job.target.id.startsWith("+")
                            ? job.target.id
                            : `+${job.target.id}`,
                        type: "text",
                        text: { body: job.object.content, preview_url: false },
                    }),
                    signal: AbortSignal.timeout(15_000),
                },
            );
            const data: unknown = await response.json();
            if (!data || typeof data !== "object") {
                throw new Error("whatsapp: invalid API response");
            }
            if ("error" in data || !response.ok) {
                const error = "error" in data ? data.error : undefined;
                let detail = `HTTP ${response.status}`;
                if (error && typeof error === "object") {
                    if ("code" in error && typeof error.code === "number") {
                        detail += `, code ${error.code}`;
                    }
                    if (
                        "message" in error &&
                        typeof error.message === "string"
                    ) {
                        detail += `: ${error.message.split(token).join("[redacted]")}`;
                    }
                }
                // 131047: more than 24 hours since the recipient last messaged.
                const windowClosed =
                    error &&
                    typeof error === "object" &&
                    "code" in error &&
                    error.code === 131047;
                const reason = windowClosed
                    ? "meta:messaging-window-closed"
                    : "whatsapp: send rejected";
                throw new Error(`${reason} (${detail})`);
            }
            const id =
                "messages" in data &&
                Array.isArray(data.messages) &&
                data.messages[0] &&
                typeof data.messages[0] === "object" &&
                "id" in data.messages[0]
                    ? data.messages[0].id
                    : undefined;
            if (typeof id !== "string" || !id) {
                throw new Error("whatsapp: API response missing message id");
            }
            result = { ...job, object: { ...job.object, id } };
        } catch (error) {
            // Network errors may contain request details; never expose tokens.
            const failure =
                error instanceof Error &&
                (error.message.startsWith("whatsapp:") ||
                    error.message.startsWith("meta:messaging-window-closed"))
                    ? new Error(error.message.split(token).join("[redacted]"))
                    : new Error(
                          "whatsapp: send failed (network error, timeout, or invalid JSON); delivery is unknown",
                      );
            this.log.warn(`send failed for actor ${job.actor.id} on whatsapp`);
            done(failure);
            return;
        }
        done(null, result);
    }
}
