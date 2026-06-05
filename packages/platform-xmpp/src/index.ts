/**
 * This is a platform for Sockethub implementing XMPP functionality.
 *
 * Developed by Nick Jennings (https://github.com/silverbucket)
 *
 * Sockethub is licensed under the LGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of this module can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about Sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

import { randomUUID } from "node:crypto";
import type {
    ActivityStream,
    Logger,
    PersistentPlatformConfig,
    PersistentPlatformInterface,
    PlatformCallback,
    PlatformSchemaStruct,
    PlatformSendToClient,
} from "@sockethub/schemas";
import {
    client,
    type XmppClientInstance,
    type XmppClientOptions,
    type XmppElement,
    xml,
} from "@xmpp/client";

import { IncomingHandlers } from "./incoming-handlers.js";
import { PlatformSchema } from "./schema.js";
import type { XmppCredentialsObject, XmppPlatformSession } from "./types.js";
import { utils } from "./utils.js";

export type { XmppCredentialsObject, XmppPlatformSession } from "./types.js";

/**
 * Handles all actions related to communication via. the XMPP protocol.
 *
 * Uses `xmpp.js` as a base tool for interacting with XMPP.
 *
 * {@link https://github.com/xmppjs/xmpp.js}
 */
export default class XMPP implements PersistentPlatformInterface {
    public credentialsHash: string | undefined;
    readonly config: PersistentPlatformConfig = {
        connectTimeoutMs: 10000,
        persist: true,
        requireCredentials: ["connect"],
    };
    readonly log: Logger;
    readonly sendToClient: PlatformSendToClient;
    /** @internal Set of bare JIDs for rooms this client has joined. */
    public __knownRooms: Set<string>;
    protected __clientConstructor: (
        options: XmppClientOptions,
    ) => XmppClientInstance;
    protected __xml: (
        name: string,
        attrs?: Record<string, string | undefined>,
        ...children: (XmppElement | undefined)[]
    ) => XmppElement;
    private readonly id: string;
    private __initialized: boolean;
    /** @internal Exposed for test access and IncomingHandlers. */
    public __client: XmppClientInstance | undefined;

    /**
     * Constructor called from the Sockethub `Platform` instance, passing in a
     * session object.
     * @param session - {@link XmppPlatformSession}
     */
    constructor(session: XmppPlatformSession) {
        this.id = session.id;
        this.log = session.log;
        this.sendToClient = session.sendToClient;
        this.credentialsHash = undefined;
        this.__initialized = false;
        this.__knownRooms = new Set();
        this.createClient();
        this.createXml();
    }

    protected createClient(): void {
        this.__clientConstructor = client;
    }

    protected createXml(): void {
        this.__xml = xml;
    }

    /**
     * Mark the platform as disconnected and uninitialized
     * @param stopReconnection - If true, stop automatic reconnection
     */
    private __markDisconnected(stopReconnection = false): void {
        this.log.debug(`marking client as disconnected for ${this.id}`);

        if (stopReconnection && this.__client) {
            this.log.debug(`stopping automatic reconnection for ${this.id}`);
            this.__client.stop();
        }

        this.__client = undefined;
        this.__initialized = false;
    }

    /**
     * Classify error to determine if reconnection should be attempted
     * @param err - The error from XMPP client
     * @returns 'RECOVERABLE' or 'NON_RECOVERABLE'
     */
    private __classifyError(
        err: Error & { condition?: string; code?: string },
    ): "RECOVERABLE" | "NON_RECOVERABLE" {
        const errorString = err.toString();

        const recoverableErrors = [
            "ECONNRESET",
            "ECONNREFUSED",
            "ETIMEDOUT",
            "ENOTFOUND",
            "EHOSTUNREACH",
            "ENETUNREACH",
        ];

        if (
            recoverableErrors.some((pattern) => errorString.includes(pattern))
        ) {
            return "RECOVERABLE";
        }

        if (err.code && recoverableErrors.includes(err.code)) {
            return "RECOVERABLE";
        }

        return "NON_RECOVERABLE";
    }

    /**
     * Check if the XMPP client is properly connected and can send messages
     * @returns true if client is connected and operational
     */
    private __isClientConnected(): boolean {
        if (!this.__client) {
            return false;
        }

        try {
            return (
                this.__client.socket !== undefined &&
                this.__client.socket.writable !== false &&
                this.__client.status === "online"
            );
        } catch (err) {
            this.log.debug("Error checking client connection status:", {
                err,
            });
            return false;
        }
    }

    /**
     * @description
     * JSON schema defining the types this platform accepts.
     *
     * Deployments that accept a bearer-style token in the SASL PLAIN password
     * slot should still pass that token string as `password`. Dedicated token
     * SASL mechanisms such as ejabberd `X-OAUTH2`, Prosody `OAUTHBEARER`,
     * Prosody community `X-TOKEN`, and SASL2 FAST are not implemented by this
     * client. See the package README for canonical credentials and usage
     * payload examples.
     **/
    get schema(): PlatformSchemaStruct {
        return PlatformSchema;
    }

    /**
     * Returns whether the platform is ready to handle jobs.
     * For XMPP, this means we have successfully connected to the server.
     * During temporary network interruptions with automatic reconnection,
     * remains true to allow queued jobs to retry rather than fail.
     * @returns true if ready to handle jobs
     */
    isInitialized(): boolean {
        return this.__initialized;
    }

    /**
     * Connect to the XMPP server.
     *
     * @param job - activity streams object
     * @param credentials - credentials object
     * @param done - callback when job is done
     */
    connect(
        job: ActivityStream,
        credentials: XmppCredentialsObject,
        done: PlatformCallback,
    ): void {
        if (this.__isClientConnected()) {
            this.log.debug(
                `client connection already exists for ${job.actor.id}`,
            );
            this.__initialized = true;
            done();
            return;
        }
        this.log.debug(`connect() called for ${job.actor.id}`);

        const xmppCreds = utils.buildXmppCredentials(credentials);
        this.log.debug(
            `building XMPP credentials for ${job.actor.id}:`,
            JSON.stringify({
                service: xmppCreds.service,
                username: xmppCreds.username,
                resource: xmppCreds.resource,
                timeout: this.config.connectTimeoutMs,
            }),
        );

        this.log.debug(`creating XMPP client for ${job.actor.id}`);

        try {
            this.__client = this.__clientConstructor({
                ...xmppCreds,
                timeout: this.config.connectTimeoutMs,
                tls: false,
            });
            this.log.debug(
                `XMPP client created successfully for ${job.actor.id}`,
            );
        } catch (err) {
            const e = err as Error;
            this.log.debug(`XMPP client creation failed for ${job.actor.id}:`, {
                err,
            });
            done(`client creation failed: ${e.message}`);
            return;
        }

        this.__client.on("offline", () => {
            this.log.debug(`offline event received for ${job.actor.id}`);
            if (!this.__initialized) {
                this.log.debug(
                    `offline during initial connection for ${job.actor.id}`,
                );
                this.__markDisconnected();
            } else {
                this.log.debug(
                    `offline after successful connection for ${job.actor.id}, will auto-reconnect`,
                );
            }
        });

        this.__client.on("error", (err: unknown) => {
            const e = err as Error & { condition?: string; code?: string };

            if (
                e instanceof TypeError ||
                e instanceof ReferenceError ||
                e instanceof SyntaxError
            ) {
                this.log.error(
                    `FATAL: Internal code error in XMPP platform: ${e.toString()}`,
                );
                this.log.error(e.stack ?? "");
                process.exit(1);
            }

            this.log.debug(
                `network error event for ${job.actor.id}:${e.toString()}`,
            );

            const errorType = this.__classifyError(e);

            const as: Record<string, unknown> = {
                type: "connect",
                actor: { id: job.actor.id },
            };

            if (errorType === "RECOVERABLE") {
                as.error = `Connection lost: ${e.toString()}. Attempting automatic reconnection...`;
                as.object = {
                    type: "connect",
                    status: "reconnecting",
                    condition: e.condition || "network",
                };
            } else {
                this.__markDisconnected(true);

                as.error = `Connection failed: ${e.toString()}. Manual reconnection required.`;
                as.object = {
                    type: "connect",
                    status: "failed",
                    condition: e.condition || "protocol",
                };
            }
            // biome-ignore lint/suspicious/noExplicitAny: ActivityStream type doesn't cover all dynamic XMPP error fields
            this.sendToClient(as as any);
        });

        this.__client.on("online", () => {
            this.log.debug(`online event received for ${job.actor.id}`);
        });

        this.log.debug(`starting XMPP client connection for ${job.actor.id}`);
        const startTime = Date.now();

        this.__client
            .start()
            .then(() => {
                const duration = Date.now() - startTime;
                this.log.debug(
                    `connection successful for ${job.actor.id} after ${duration}ms`,
                );
                this.__initialized = true;
                this.__registerHandlers();
                return done();
            })
            .catch((err: unknown) => {
                const e = err as Error & { code?: string };
                const duration = Date.now() - startTime;
                this.log.debug(
                    `connection failed for ${job.actor.id} after ${duration}ms:`,
                    {
                        error: e,
                        message: e?.message,
                        code: e?.code,
                        stack: e?.stack,
                    },
                );
                this.__client = undefined;
                return done(
                    `connection failed: ${e?.message || e}. (service: ${xmppCreds.service})`,
                );
            });
    }

    /**
     * Join a room, optionally defining a display name for that room.
     *
     * @param job - activity streams object
     * @param done - callback when job is done
     */
    async join(job: ActivityStream, done: PlatformCallback): Promise<void> {
        const roomJid = job.target?.id.split("/")[0];
        this.log.debug(
            `sending join from ${job.actor.id} to ` +
                `${roomJid}/${job.actor.name}`,
        );
        const presence = this.__xml(
            "presence",
            {
                from: job.actor.id,
                to: `${roomJid}/${job.actor.name || roomJid}`,
            },
            this.__xml("x", { xmlns: "http://jabber.org/protocol/muc" }),
        );

        return this.__client
            ?.send(presence)
            .then(() => {
                this.__knownRooms.add(roomJid);
                done();
            })
            .catch((err: unknown) => done(err as Error));
    }

    /**
     * Leave a room
     *
     * @param job - activity streams object
     * @param done - callback when job is done
     */
    leave(job: ActivityStream, done: PlatformCallback): void {
        const roomJid = job.target?.id.split("/")[0];
        this.log.debug(
            `sending leave from ${job.actor.id} to ` +
                `${roomJid}/${job.actor.name}`,
        );

        this.__client
            ?.send(
                this.__xml("presence", {
                    from: job.actor.id,
                    to: `${roomJid}/${job.actor.name || roomJid}`,
                    type: "unavailable",
                }),
            )
            .then(() => {
                this.__knownRooms.delete(roomJid);
                done();
            })
            .catch((err: unknown) => done(err as Error));
    }

    /**
     * Send a message to a room or private conversation.
     *
     * @param job - activity streams object
     * @param done - callback when job is done
     */
    send(job: ActivityStream, done: PlatformCallback): void {
        this.log.debug(`send() called for ${job.actor.id}`);
        const message = this.__xml(
            "message",
            {
                type: job.target?.type === "room" ? "groupchat" : "chat",
                to: job.target?.id,
                id: job.object?.id as string | undefined,
            },
            this.__xml("body", {}, job.object?.content as string | undefined),
            (job.object?.["xmpp:replace"] as { id: string } | undefined)
                ? this.__xml("replace", {
                      id: (job.object?.["xmpp:replace"] as { id: string }).id,
                      xmlns: "urn:xmpp:message-correct:0",
                  })
                : undefined,
        );
        this.__client?.send(message).then(done);
    }

    /**
     * @description
     * Indicate presence and status message.
     * Valid presence values are "away", "chat", "dnd", "xa", "offline", "online".
     *
     * @param job - activity streams object
     * @param done - callback when job is done
     */
    update(job: ActivityStream, done: PlatformCallback): void {
        this.log.debug(`update() called for ${job.actor.id}`);
        const props: Record<string, string | undefined> = {};
        const show: Record<string, string | undefined> = {};
        const status: Record<string, string | undefined> = {};
        if (job.object?.type === "presence") {
            if (job.object.presence === "offline") {
                props.type = "unavailable";
            } else if (job.object.presence !== "online") {
                show.show = job.object.presence as string;
            }
            if (job.object.content) {
                status.status = job.object.content as string;
            }
            this.log.debug(`setting presence: ${job.object.presence}`);
            this.__client
                ?.send(
                    this.__xml(
                        "presence",
                        props,
                        show as XmppElement,
                        status as XmppElement,
                    ),
                )
                .then(done);
        } else {
            done(`unknown update object type: ${job.object?.type}`);
        }
    }

    /**
     * @description
     * Send friend request
     *
     * @param job - activity streams object
     * @param done - callback when job is done
     */
    "request-friend"(job: ActivityStream, done: PlatformCallback): void {
        this.log.debug(`request-friend() called for ${job.actor.id}`);
        this.__client
            ?.send(
                this.__xml("presence", {
                    type: "subscribe",
                    to: job.target?.id,
                }),
            )
            .then(done);
    }

    /**
     * @description
     * Send a remove friend request
     *
     * @param job - activity streams object
     * @param done - callback when job is done
     */
    "remove-friend"(job: ActivityStream, done: PlatformCallback): void {
        this.log.debug(`remove-friend() called for ${job.actor.id}`);
        this.__client
            ?.send(
                this.__xml("presence", {
                    type: "unsubscribe",
                    to: job.target?.id,
                }),
            )
            .then(done);
    }

    /**
     * @description
     * Confirm a friend request
     *
     * @param job - activity streams object
     * @param done - callback when job is done
     */
    "make-friend"(job: ActivityStream, done: PlatformCallback): void {
        this.log.debug(`make-friend() called for ${job.actor.id}`);
        this.__client
            ?.send(
                this.__xml("presence", {
                    type: "subscribe",
                    to: job.target?.id,
                }),
            )
            .then(done);
    }

    /**
     * Indicate an intent to query something (e.g. get room attendance or room information).
     *
     * @param job - activity streams object
     * @param done - callback when job is done
     */
    query(job: ActivityStream, done: PlatformCallback): void {
        const queryType = (job.object?.type as string) || "attendance";
        this.log.debug(
            `sending ${queryType} query from ${job.actor.id} for ${job.target?.id}`,
        );

        if (queryType === "room-info") {
            const queryId = `room_info_${randomUUID()}`;

            this.__client
                ?.send(
                    this.__xml(
                        "iq",
                        {
                            id: queryId,
                            type: "get",
                            from: job.actor.id,
                            to: job.target?.id,
                        },
                        this.__xml("query", {
                            xmlns: "http://jabber.org/protocol/disco#info",
                        }),
                    ),
                )
                .then(done)
                .catch(done);
        } else {
            this.__client
                ?.send(
                    this.__xml(
                        "iq",
                        {
                            id: "muc_id",
                            type: "get",
                            from: job.actor.id,
                            to: job.target?.id,
                        },
                        this.__xml("query", {
                            xmlns: "http://jabber.org/protocol/disco#items",
                        }),
                    ),
                )
                .then(done)
                .catch(done);
        }
    }

    /**
     * Disconnect XMPP client
     * @param _job - activity streams object
     * @param done - callback when done
     */
    disconnect(_job: ActivityStream, done: PlatformCallback): void {
        this.log.debug("disconnecting");
        this.cleanup(done);
    }

    /**
     * Called when it's time to close any connections or clean data before being wiped
     * forcefully.
     * @param done - callback when complete
     */
    cleanup(done: PlatformCallback): void {
        this.log.debug("cleanup");
        this.__initialized = false;
        this.__knownRooms.clear();
        if (this.__client && typeof this.__client.stop === "function") {
            this.__client.stop();
        }
        done();
    }

    private __registerHandlers(): void {
        const ih = new IncomingHandlers(this);
        this.__client?.on("close", ih.close.bind(ih));
        this.__client?.on("error", ih.error.bind(ih));
        this.__client?.on("online", ih.online.bind(ih));
        this.__client?.on("stanza", ih.stanza.bind(ih));
    }
}
