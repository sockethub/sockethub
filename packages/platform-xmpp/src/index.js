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

import { client, xml } from "@xmpp/client";

import { IncomingHandlers } from "./incoming-handlers.js";
import { PlatformSchema } from "./schema.js";
import { utils } from "./utils.js";

/**
 * Handles all actions related to communication via. the XMPP protocol.
 *
 * Uses `xmpp.js` as a base tool for interacting with XMPP.
 *
 * {@link https://github.com/xmppjs/xmpp.js}
 */
export default class XMPP {
    /**
     * Constructor called from the Sockethub `Platform` instance, passing in a
     * session object.
     * @param {object} session - {@link Sockethub.Platform.PlatformSession#object}
     */
    constructor(session) {
        this.id = session.id; // actor
        this.config = {
            connectTimeoutMs: 10000,
            persist: true,
            initialized: false,
            requireCredentials: ["connect"],
        };
        this.log = session.log;
        this.sendToClient = session.sendToClient;
        this.createClient();
        this.createXml();
    }

    createClient() {
        this.__clientConstructor = client;
    }
    createXml() {
        this.__xml = xml;
    }

    /**
     * Mark the platform as disconnected and uninitialized
     * @param {boolean} stopReconnection - If true, stop automatic reconnection
     */
    __markDisconnected(stopReconnection = false) {
        this.log.debug(`marking client as disconnected for ${this.id}`);

        if (stopReconnection && this.__client) {
            this.log.debug(`stopping automatic reconnection for ${this.id}`);
            this.__client.stop();
        }

        this.__client = undefined;
        this.config.initialized = false;
    }

    /**
     * Classify error to determine if reconnection should be attempted
     * @param {Error} err - The error from XMPP client
     * @returns {string} 'RECOVERABLE' or 'NON_RECOVERABLE'
     */
    __classifyError(err) {
        const errorString = err.toString();
        const condition = err.condition;

        // ONLY these errors are safe to reconnect on
        const recoverableErrors = [
            "ECONNRESET", // Network connection reset
            "ECONNREFUSED", // Connection refused (server down)
            "ETIMEDOUT", // Network timeout
            "ENOTFOUND", // DNS resolution failed
            "EHOSTUNREACH", // Host unreachable
            "ENETUNREACH", // Network unreachable
        ];

        // Check if this is explicitly a recoverable network error
        if (
            recoverableErrors.some((pattern) => errorString.includes(pattern))
        ) {
            return "RECOVERABLE";
        }

        // Also check for specific network-level error codes
        if (err.code && recoverableErrors.includes(err.code)) {
            return "RECOVERABLE";
        }

        // DEFAULT: Everything else is non-recoverable
        // This includes:
        // - StreamError: conflict
        // - SASLError: not-authorized
        // - StreamError: policy-violation
        // - Any unknown XMPP protocol errors
        // - Any authentication failures
        // - Any server policy violations
        // - Any new error types we haven't seen before
        return "NON_RECOVERABLE";
    }

    /**
     * Check if the XMPP client is properly connected and can send messages
     * @returns {boolean} true if client is connected and operational
     */
    __isClientConnected() {
        if (!this.__client) {
            return false;
        }

        // Check if the client has a socket and it's writable
        try {
            return (
                this.__client.socket &&
                this.__client.socket.writable !== false &&
                this.__client.status === "online"
            );
        } catch (err) {
            this.log.debug("Error checking client connection status:", err);
            return false;
        }
    }

    /**
     * @description
     * JSON schema defining the types this platform accepts.
     *
     * Actual handling of incoming 'set' commands are handled by dispatcher,
     * but the dispatcher uses this defined schema to validate credentials
     * received, so that when a @context type is called, it can fetch the
     * credentials (`session.getConfig()`), knowing they will have already been
     * validated against this schema.
     *
     *
     * In the below example, Sockethub will validate the incoming credentials object
     * against whatever is defined in the `credentials` portion of the schema
     * object.
     *
     *
     * It will also check if the incoming AS object uses a type which exists in the
     * `types` portion of the schema object (should be an array of type names).
     *
     * **NOTE**: For more information on using the credentials object from a client,
     * see [Sockethub Client](https://github.com/sockethub/sockethub/wiki/Sockethub-Client)
     *
     * Valid AS object for setting XMPP credentials:
     *
     * @example
     *
     * {
     *   type: 'credentials',
     *   context: 'xmpp',
     *   actor: {
     *     id: 'testuser@jabber.net',
     *     type: 'person',
     *     name: 'Mr. Test User'
     *   },
     *   object: {
     *     type: 'credentials',
     *     userAddress: 'testuser@jabber.net',
     *     password: 'asdasdasdasd',
     *     resource: 'phone'
     *   }
     * }
     **/
    get schema() {
        return PlatformSchema;
    }

    /**
     * Returns whether the platform is ready to handle jobs.
     * For XMPP, this means we have successfully connected to the server.
     * During temporary network interruptions with automatic reconnection,
     * remains true to allow queued jobs to retry rather than fail.
     * @returns {boolean} true if ready to handle jobs
     */
    isInitialized() {
        return this.config.initialized;
    }

    /**
     * Connect to the XMPP server.
     *
     * @param {object} job activity streams object
     * @param {object} credentials credentials object
     * @param {object} done callback when job is done
     *
     * @example
     *
     * {
     *   context: 'xmpp',
     *   type: 'connect',
     *   actor: {
     *     id: 'slvrbckt@jabber.net/Home',
     *     type: 'person',
     *     name: 'Nick Jennings',
     *     userName: 'slvrbckt'
     *   }
     * }
     */
    connect(job, credentials, done) {
        if (this.__isClientConnected()) {
            this.log.debug(
                `client connection already exists for ${job.actor.id}`,
            );
            this.config.initialized = true;
            return done();
        }
        this.log.debug(`connect() called for ${job.actor.id}`);

        // Log credential processing
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

        // Log before client creation
        this.log.debug(`creating XMPP client for ${job.actor.id}`);

        try {
            this.__client = this.__clientConstructor({
                ...xmppCreds,
                ...{ timeout: this.config.connectTimeoutMs, tls: false },
            });
            this.log.debug(
                `XMPP client created successfully for ${job.actor.id}`,
            );
        } catch (err) {
            this.log.debug(
                `XMPP client creation failed for ${job.actor.id}:`,
                err,
            );
            return done(`client creation failed: ${err.message}`);
        }

        this.__client.on("offline", () => {
            this.log.debug(`offline event received for ${job.actor.id}`);
            // Don't mark as uninitialized - automatic reconnection will handle recovery.
            // Setting initialized=false would cause queued jobs to fail unnecessarily.
            // The client library handles reconnection automatically.
            this.__client = undefined;
        });

        this.__client.on("error", (err) => {
            this.log.debug(
                `network error event for ${job.actor.id}:${err.toString()}`,
            );

            const errorType = this.__classifyError(err);

            const as = {
                context: "xmpp",
                type: "connect",
                actor: { id: job.actor.id },
            };

            if (errorType === "RECOVERABLE") {
                // On recoverable errors, keep initialized=true since automatic reconnection will occur.
                // This prevents queued jobs from being rejected during brief network interruptions.
                // Only clear the client reference to trigger reconnection logic.
                if (this.__client) {
                    this.__client.stop();
                    this.__client = undefined;
                }

                as.error = `Connection lost: ${err.toString()}. Attempting automatic reconnection...`;
                as.object = {
                    type: "connect",
                    status: "reconnecting",
                    condition: err.condition || "network",
                };
            } else {
                // On unrecoverable errors, mark as uninitialized and stop reconnection
                this.__markDisconnected(true);

                as.error = `Connection failed: ${err.toString()}. Manual reconnection required.`;
                as.object = {
                    type: "connect",
                    status: "failed",
                    condition: err.condition || "protocol",
                };
            }
            this.sendToClient(as);
        });

        this.__client.on("online", () => {
            this.log.debug(`online event received for ${job.actor.id}`);
            // If platform was already initialized, this is a reconnection.
            // Restore initialized flag so queued jobs can proceed.
            if (this.config.persist && !this.config.initialized) {
                // Check if this is a reconnection (handlers already registered)
                if (this.__client) {
                    this.log.info(
                        `automatic reconnection successful for ${job.actor.id}`,
                    );
                    this.config.initialized = true;
                }
            }
        });

        this.log.debug(`starting XMPP client connection for ${job.actor.id}`);
        const startTime = Date.now();

        this.__client
            .start()
            .then(() => {
                // connected
                const duration = Date.now() - startTime;
                this.log.debug(
                    `connection successful for ${job.actor.id} after ${duration}ms`,
                );
                this.config.initialized = true;
                this.__registerHandlers();
                return done();
            })
            .catch((err) => {
                const duration = Date.now() - startTime;
                this.log.debug(
                    `connection failed for ${job.actor.id} after ${duration}ms:`,
                    {
                        error: err,
                        message: err?.message,
                        code: err?.code,
                        stack: err?.stack,
                    },
                );
                this.__client = undefined;
                return done(
                    `connection failed: ${err?.message || err}. (service: ${xmppCreds.service})`,
                );
            });
    }

    /**
     * Join a room, optionally defining a display name for that room.
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     *
     * @example
     *
     * {
     *   context: 'xmpp',
     *   type: 'join',
     *   actor: {
     *     type: 'person',
     *     id: 'slvrbckt@jabber.net/Home',
     *     name: 'Mr. Pimp'
     *   },
     *   target: {
     *     type: 'room',
     *     id: 'PartyChatRoom@muc.jabber.net'
     *   }
     * }
     */
    async join(job, done) {
        this.log.debug(
            `sending join from ${job.actor.id} to ` +
                `${job.target.id}/${job.actor.name}`,
        );
        // TODO optional passwords not handled for now
        // TODO investigate implementation reserved nickname discovery
        const id = job.target.id.split("/")[0];

        const presence = this.__xml(
            "presence",
            {
                from: job.actor.id,
                to: `${job.target.id}/${job.actor.name || id}`,
            },
            this.__xml("x", { xmlns: "http://jabber.org/protocol/muc" }),
        );

        return this.__client.send(presence).then(done).catch(done);
    }

    /**
     * Leave a room
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     *
     * @example
     *
     * {
     *   context: 'xmpp',
     *   type: 'leave',
     *   actor: {
     *     type: 'person',
     *     id: 'slvrbckt@jabber.net/Home',
     *     name: 'slvrbckt'
     *   },
     *   target: {
     *     type: 'room'
     *     id: 'PartyChatRoom@muc.jabber.net',
     *   }
     * }
     */
    leave(job, done) {
        this.log.debug(
            `sending leave from ${job.actor.id} to ` +
                `${job.target.id}/${job.actor.name}`,
        );

        const id = job.target.id.split("/")[0];

        this.__client
            .send(
                this.__xml("presence", {
                    from: job.actor.id,
                    to:
                        job.target?.id && job.actor?.name
                            ? `${job.target.id}/${job.actor.name}`
                            : id,
                    type: "unavailable",
                }),
            )
            .then(done);
    }

    /**
     * Send a message to a room or private conversation.
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     *
     * @example
     *
     * {
     *   context: 'xmpp',
     *   type: 'send',
     *   actor: {
     *     id: 'slvrbckt@jabber.net/Home',
     *     type: 'person',
     *     name: 'Nick Jennings',
     *     userName: 'slvrbckt'
     *   },
     *   target: {
     *     id: 'homer@jabber.net/Home',
     *     type: 'user',
     *     name: 'Homer'
     *   },
     *   object: {
     *     type: 'message',
     *     content: 'Hello from Sockethub!'
     *   }
     * }
     *
     * {
     *   context: 'xmpp',
     *   type: 'send',
     *   actor: {
     *     id: 'slvrbckt@jabber.net/Home',
     *     type: 'person',
     *     name: 'Nick Jennings',
     *     userName: 'slvrbckt'
     *   },
     *   target: {
     *     id: 'party-room@jabber.net',
     *     type: 'room'
     *   },
     *   object: {
     *     type: 'message',
     *     content: 'Hello from Sockethub!'
     *   }
     * }
     *
     */
    send(job, done) {
        this.log.debug(`send() called for ${job.actor.id}`);
        // send message
        const message = this.__xml(
            "message",
            {
                type: job.target.type === "room" ? "groupchat" : "chat",
                to: job.target.id,
                id: job.object.id,
            },
            this.__xml("body", {}, job.object.content),
            job.object["xmpp:replace"]
                ? this.__xml("replace", {
                      id: job.object["xmpp:replace"].id,
                      xmlns: "urn:xmpp:message-correct:0",
                  })
                : undefined,
        );
        this.__client.send(message).then(done);
    }

    /**
     * @description
     * Indicate presence and status message.
     * Valid presence values are "away", "chat", "dnd", "xa", "offline", "online".
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     *
     * @example
     *
     * {
     *   context: 'xmpp',
     *   type: 'update',
     *   actor: {
     *     id: 'user@host.org/Home'
     *   },
     *   object: {
     *     type: 'presence'
     *     presence: 'away',
     *     content: '...clever saying goes here...'
     *   }
     * }
     */
    update(job, done) {
        this.log.debug(`update() called for ${job.actor.id}`);
        const props = {};
        const show = {};
        const status = {};
        if (job.object.type === "presence") {
            if (job.object.presence === "offline") {
                props.type = "unavailable";
            } else if (job.object.presence !== "online") {
                show.show = job.object.presence;
            }
            if (job.object.content) {
                status.status = job.object.content;
            }
            // setting presence
            this.log.debug(`setting presence: ${job.object.presence}`);
            this.__client
                .send(this.__xml("presence", props, show, status))
                .then(done);
        } else {
            done(`unknown update object type: ${job.object.type}`);
        }
    }

    /**
     * @description
     * Send friend request
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     *
     * @example
     *
     * {
     *   context: 'xmpp',
     *   type: 'request-friend',
     *   actor: {
     *     id: 'user@host.org/Home'
     *   },
     *   target: {
     *     id: 'homer@jabber.net/Home',
     *   }
     * }
     */
    "request-friend"(job, done) {
        this.log.debug(`request-friend() called for ${job.actor.id}`);
        this.__client
            .send(
                this.__xml("presence", {
                    type: "subscribe",
                    to: job.target.id,
                }),
            )
            .then(done);
    }

    /**
     * @description
     * Send a remove friend request
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     *
     * @example
     *
     * {
     *   context: 'xmpp',
     *   type: 'remove-friend',
     *   actor: {
     *     id: 'user@host.org/Home'
     *   },
     *   target: {
     *     id: 'homer@jabber.net/Home',
     *   }
     * }
     */
    "remove-friend"(job, done) {
        this.log.debug(`remove-friend() called for ${job.actor.id}`);
        this.__client
            .send(
                this.__xml("presence", {
                    type: "unsubscribe",
                    to: job.target.id,
                }),
            )
            .then(done);
    }

    /**
     * @description
     * Confirm a friend request
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     *
     * @example
     *
     * {
     *   context: 'xmpp',
     *   type: 'make-friend',
     *   actor: {
     *     id: 'user@host.org/Home'
     *   },
     *   target: {
     *     id: 'homer@jabber.net/Home',
     *   }
     * }
     */
    "make-friend"(job, done) {
        this.log.debug(`make-friend() called for ${job.actor.id}`);
        this.__client
            .send(
                this.__xml("presence", {
                    type: "subscribe",
                    to: job.target.id,
                }),
            )
            .then(done);
    }

    /**
     * Indicate an intent to query something (i.e. get a list of users in a room).
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     *
     * @example
     *
     *  {
     *    context: 'xmpp',
     *    type: 'query',
     *    actor: {
     *      id: 'slvrbckt@jabber.net/Home',
     *      type: 'person'
     *    },
     *    target: {
     *      id: 'PartyChatRoom@muc.jabber.net',
     *      type: 'room'
     *    },
     *    object: {
     *      type: 'attendance'
     *    }
     *  }
     *
     *  // The above object might return:
     *  {
     *    context: 'xmpp',
     *    type: 'query',
     *    actor: {
     *      id: 'PartyChatRoom@muc.jabber.net',
     *      type: 'room'
     *    },
     *    target: {
     *      id: 'slvrbckt@jabber.net/Home',
     *      type: 'person'
     *    },
     *    object: {
     *      type: 'attendance'
     *      members: [
     *        'RyanGosling',
     *        'PeeWeeHerman',
     *        'Commando',
     *        'Smoochie',
     *        'neo'
     *      ]
     *    }
     *  }
     */
    query(job, done) {
        this.log.debug(
            `sending query from ${job.actor.id} for ${job.target.id}`,
        );
        this.__client
            .send(
                this.__xml(
                    "iq",
                    {
                        id: "muc_id",
                        type: "get",
                        from: job.actor.id,
                        to: job.target.id,
                    },
                    this.__xml("query", {
                        xmlns: "http://jabber.org/protocol/disco#items",
                    }),
                ),
            )
            .then(done);
    }

    /**
     * Disconnect XMPP client
     * @param {object} job activity streams object
     * @param done
     *
     * @example
     *
     * {
     *    context: 'xmpp',
     *    type: 'disconnect',
     *    actor: {
     *      id: 'slvrbckt@jabber.net/Home',
     *      type: 'person'
     *    }
     *  }
     */
    disconnect(job, done) {
        this.log.debug("disconnecting");
        this.cleanup(done);
    }

    /**
     * Called when it's time to close any connections or clean data before being wiped
     * forcefully.
     * @param {function} done - callback when complete
     */
    cleanup(done) {
        this.log.debug("cleanup");
        this.config.initialized = false;
        this.__client.stop();
        done();
    }

    __registerHandlers() {
        const ih = new IncomingHandlers(this);
        this.__client.on("close", ih.close.bind(ih));
        this.__client.on("error", ih.error.bind(ih));
        this.__client.on("online", ih.online.bind(ih));
        this.__client.on("stanza", ih.stanza.bind(ih));
    }
}
