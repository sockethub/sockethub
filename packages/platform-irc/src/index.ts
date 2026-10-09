/**
 * This is a platform for Sockethub implementing IRC functionality.
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

import net from "node:net";
import tls from "node:tls";

import { IrcToActivityStreams } from "@sockethub/irc2as";
import type {
    ActivityStream,
    Logger,
    PersistentPlatformConfig,
    PersistentPlatformInterface,
    PlatformCallback,
    PlatformPrepareActorUpdate,
    PlatformSchemaStruct,
    PlatformSendToClient,
    PlatformSession,
    PlatformUpdateActor,
} from "@sockethub/schemas";
import { buildCanonicalContext } from "@sockethub/schemas";
import IrcSocket, { type IrcSocketInstance } from "irc-socket-sasl";

import { PlatformIrcSchema } from "./schema.js";
import type { PlatformIrcCredentialsObject } from "./types.js";

export type { IrcSocketInstance } from "irc-socket-sasl";
export type { PlatformIrcCredentialsObject } from "./types.js";

// irc-socket-sasl >=4.1.2 already flattens connectOptions into a plain
// object before handing them to the transport (silverbucket/irc-socket-sasl#24),
// so this is now a defensive backstop rather than the primary fix: earlier
// versions built the options via `Object.create(connectOptions)`, which put
// our `rejectUnauthorized` setting on the prototype rather than as an own
// property, and Node's `tls.connect` only honors it as an own property.
// Keeping this here means we don't depend on the installed dependency
// version (or a future regression/fork) to get this right.
export function flattenConnectOptions(
    options: Record<string, unknown>,
): Record<string, unknown> {
    const flattened: Record<string, unknown> = Object.create(null);
    for (const key in options) {
        if (
            key === "__proto__" ||
            key === "constructor" ||
            key === "prototype"
        ) {
            continue;
        }
        flattened[key] = options[key];
    }
    return flattened;
}

const tlsTransport = {
    connect(options: Record<string, unknown>, ...rest: Array<unknown>) {
        return (tls.connect as unknown as (...args: Array<unknown>) => unknown)(
            flattenConnectOptions(options),
            ...rest,
        );
    },
};

export type GetClientCallback = (
    err: string | null,
    client?: IrcSocketInstance,
) => void;

type JobQueueHandler = (err?: Error | string) => void | Promise<void>;

type JobAck = "pong" | "nickAck";

interface QueuedJob {
    handler: JobQueueHandler;
    ack: JobAck;
}

const IRC_LINE_BREAK = /[\r\n]/;

function ircLineBreakError(values: Array<unknown>): string | undefined {
    if (
        values.some(
            (value) => typeof value === "string" && IRC_LINE_BREAK.test(value),
        )
    ) {
        return "IRC values must not contain CR or LF characters";
    }
}

/**
 * irc2as puts numeric-reply text on `error`, not `object.content`. Reading
 * `object.content` throws, and the platform process treats that as fatal.
 * A non-empty string is required so a nick-change handler takes its failure
 * path instead of adopting a nick the server rejected.
 */
function ircFailureMessage(asObject: ActivityStream): string {
    if (typeof asObject.error === "string" && asObject.error.length > 0) {
        return asObject.error;
    }
    const content = asObject.object?.content;
    if (typeof content === "string" && content.length > 0) {
        return content;
    }
    return "IRC error";
}

interface IrcSocketOptionsCapabilities {
    requires: string[];
}

interface IrcSocketConnectResponse {
    isFail(): boolean;
    fail(): string;
    ok(): boolean;
    end(): void;
}

interface IrcSocketOptionsConnect {
    rejectUnauthorized: boolean;
}
interface IrcSocketOptions {
    username: string;
    nicknames: string[];
    server: string;
    realname: string;
    port: number;
    debug: typeof console.log;
    saslMechanism?: "PLAIN" | "OAUTHBEARER";
    saslPassword?: string;
    capabilities?: IrcSocketOptionsCapabilities;
    connectOptions?: IrcSocketOptionsConnect;
}

/**
 * Handles all actions related to communication via the IRC protocol.
 */
export class IRC implements PersistentPlatformInterface {
    private readonly log: Logger;
    public credentialsHash: string | undefined;
    config: PersistentPlatformConfig = {
        persist: true,
        requireCredentials: ["connect", "update"],
        connectTimeoutMs: 30000,
    };
    private readonly updateActor: PlatformUpdateActor;
    private readonly prepareActorUpdate?: PlatformPrepareActorUpdate;
    private readonly sendToClient: PlatformSendToClient;
    private irc2as!: IrcToActivityStreams;
    private forceDisconnect = false;
    private clientConnecting = false;
    private initialized = false;
    // Guards releaseConnection against the socket 'close' it triggers.
    private releasing = false;
    private client?: IrcSocketInstance;
    private jobQueue: Array<QueuedJob> = []; // handlers waiting for a matching ack
    // A numeric error completes the in-flight command before its PING is
    // answered. That PONG must not acknowledge the command that runs next.
    private pongAcksToSkip = 0;
    private channels = new Set();
    private handledActors = new Set();
    private credentials?: PlatformIrcCredentialsObject;

    constructor(session: PlatformSession) {
        this.log = session.log;
        this.sendToClient = session.sendToClient;
        this.updateActor = session.updateActor;
        this.prepareActorUpdate = session.prepareActorUpdate;
    }

    /**
     * JSON schema defining the types this platform accepts.
     *
     * `password` and `token` are mutually exclusive. Both default to SASL
     * PLAIN; set `saslMechanism: 'OAUTHBEARER'` explicitly for OAuth 2.0
     * bearer tokens (RFC 7628). See the package README for canonical
     * credentials payload examples.
     */
    get schema(): PlatformSchemaStruct {
        return PlatformIrcSchema;
    }

    /**
     * Returns whether the platform is ready to handle jobs.
     * For IRC, this means we have successfully connected to the server.
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Function: connect
     *
     * Connect to an IRC server.
     *
     * @param {object} job activity streams object
     * @param {object} credentials credentials object
     * @param {object} done callback when job is done
     */
    connect(
        job: ActivityStream,
        credentials: PlatformIrcCredentialsObject,
        done: PlatformCallback,
    ) {
        this.getClient(job.actor.id, credentials, (err) => {
            if (err) {
                return done(err);
            }
            return done();
        });
    }

    /**
     * Function: join
     *
     * Join a room or private conversation.
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     */
    join(job: ActivityStream, done: PlatformCallback) {
        this.log.debug(`join() called for ${job.actor.id}`);
        const lineBreakError = ircLineBreakError([
            job.actor.name,
            job.target.id,
            job.target.name,
        ]);
        if (lineBreakError) return done(lineBreakError);
        this.getClient(job.actor.id, false, (err, client) => {
            if (err) {
                return done(err);
            }
            const channel = this.resolveIrcTarget(job.target);
            if (!channel) {
                return done(
                    "IRC room targets must be server-qualified as '#channel@server'",
                );
            }
            if (this.channels.has(channel)) {
                this.log.debug(`channel ${channel} already joined`);
                return done();
            }
            // join channel
            this.jobQueue.push({
                ack: "pong",
                handler: (err?: Error | string) => {
                    if (err) {
                        return done(err);
                    }
                    this.hasJoined(channel);
                    done();
                },
            });
            this.log.debug(`sending join ${channel}`);
            client.raw(["JOIN", channel]);
            client.raw(`PING ${job.actor.name}`);
        });
    }

    /**
     * Function leave
     *
     * Leave a room or private conversation.
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     */
    leave(job: ActivityStream, done: PlatformCallback) {
        this.log.debug(`leave() called for ${job.actor.name}`);
        const lineBreakError = ircLineBreakError([
            job.target.id,
            job.target.name,
        ]);
        if (lineBreakError) return done(lineBreakError);
        this.getClient(job.actor.id, false, (err, client) => {
            if (err) {
                return done(err);
            }
            const channel = this.resolveIrcTarget(job.target);
            if (!channel) {
                return done(
                    "IRC room targets must be server-qualified as '#channel@server'",
                );
            }
            // leave channel
            this.hasLeft(channel);
            client.raw(["PART", channel]);
            done();
        });
    }

    /**
     * Function: send
     *
     * Send a message to a room or private conversation.
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     */
    send(job: ActivityStream, done: PlatformCallback) {
        this.log.debug(
            `send() called for ${job.actor.id} target: ${job.target.id}`,
        );
        const lineBreakError = ircLineBreakError([
            job.actor.name,
            job.target.id,
            job.target.name,
            job.object?.content,
        ]);
        if (lineBreakError) return done(lineBreakError);
        this.getClient(job.actor.id, false, async (err, client) => {
            if (err) {
                return done(err);
            }

            if (typeof job.object.content !== "string") {
                return done("cannot send message with no object.content");
            }

            const recipient = this.resolveIrcTarget(job.target);
            if (!recipient) {
                return done(
                    "IRC room targets must be server-qualified as '#channel@server'",
                );
            }

            const match = /(\/\w+)\s*([\s\S]*)/.exec(job.object.content);
            if (match) {
                const cmd = match[1].substring(1).toUpperCase(); // get command
                const msg = match[2].trim(); // remove leading/trailing whitespace from remaining text
                if (cmd === "ME") {
                    // handle /me messages uniquely
                    job.object.type = "me";
                    job.object.content = msg;
                } else if (cmd === "NOTICE") {
                    // attempt to send as raw command
                    job.object.type = "notice";
                    job.object.content = msg;
                }
            } else {
                job.object.content = job.object.content.trim();
            }

            if (job.object.type === "me") {
                // message intended as command
                // CTCP ACTION: the payload is wrapped in \x01 delimiters
                client.raw(
                    `PRIVMSG ${recipient} :\x01ACTION ${job.object.content}\x01`,
                );
                // /me intentionally reports synchronous success rather than
                // going through the jobQueue + PING/PONG round-trip used by
                // normal sends. This is safe because:
                //   1. IRC servers do not echo PRIVMSG/CTCP ACTION back to
                //      the sender unless the IRCv3 `echo-message` capability
                //      is negotiated via CAP REQ.
                //   2. This platform only requests `sasl` (see ircConnect:
                //      `capabilities = { requires: ["sasl"] }`), so
                //      `echo-message` is never enabled.
                //   3. Therefore the outgoing PRIVMSG never re-enters
                //      irc2as.input() via the `data` event, no `incoming`
                //      event fires for the sender's actor, and completeJob
                //      is not triggered as a side effect.
                // If `echo-message` is ever enabled, the regular send path
                // would also need refactoring to dedupe echoed PRIVMSGs.
                return done();
            }
            if (job.object.type === "notice") {
                // attempt to send as raw command
                client.raw(`NOTICE ${recipient} :${job.object.content}`);
            } else if (this.isJoined(recipient)) {
                client.raw(`PRIVMSG ${recipient} :${job.object.content}`);
            } else {
                return done(
                    "cannot send message to a channel of which you've not first joined.",
                );
            }
            this.jobQueue.push({ ack: "pong", handler: done });
            client.raw(`PING ${job.actor.name}`);
        });
    }

    /**
     * Function: update
     *
     * Indicate a change (i.e. room topic update, or nickname change).
     *
     * @param {object} job activity streams object
     * @param {object} credentials credentials to verify this user is the right one
     * @param {object} done callback when job is done
     */
    update(
        job: ActivityStream,
        credentials: PlatformIrcCredentialsObject,
        done: PlatformCallback,
    ) {
        this.log.debug(`update() called for ${job.actor.id}`);
        const lineBreakError = ircLineBreakError([
            job.actor.name,
            job.target.id,
            job.target.name,
            job.object?.content,
        ]);
        if (lineBreakError) return done(lineBreakError);
        this.getClient(job.actor.id, false, async (err, client) => {
            if (err) {
                return done(err);
            }
            if (job.object.type === "address") {
                this.log.debug(
                    `changing nick from ${job.actor.name} to ${job.target.name}`,
                );
                // Refuse a collision before NICK reaches the server. The
                // credential check used to run only after the server accepted
                // the nick, so a refusal left this connection on the new nick
                // while the client was told the rename failed.
                if (this.prepareActorUpdate) {
                    const proposed = structuredClone(credentials);
                    proposed.object.nick = job.target.name;
                    proposed.actor = {
                        ...proposed.actor,
                        id: `${job.target.name}@${credentials.object.server}`,
                        name: job.target.name,
                    };
                    try {
                        await this.prepareActorUpdate(proposed);
                    } catch (updateErr) {
                        const message =
                            updateErr instanceof Error
                                ? updateErr.message
                                : String(updateErr);
                        return done(message);
                    }
                }
                // Do not mark the requested nick as ours until the server
                // accepts it. Doing so earlier consumes that nick's live
                // traffic as this job's completion, so a taken nick can be
                // reported as a successful change and those messages never
                // reach the client.
                this.jobQueue.push({
                    ack: "nickAck",
                    handler: async (err: Error) => {
                        if (err) {
                            return done(err);
                        }
                        const updated = structuredClone(credentials);
                        updated.object.nick = job.target.name;
                        updated.actor.id = `${job.target.name}@${credentials.object.server}`;
                        updated.actor.name = job.target.name;
                        try {
                            await this.updateActor(updated);
                        } catch (updateErr) {
                            const message =
                                updateErr instanceof Error
                                    ? updateErr.message
                                    : String(updateErr);
                            // The server already accepted the nick. Keeping
                            // the socket would leave us on a nick that was
                            // not stored, with the old nick still marked as
                            // ours.
                            this.releaseConnection(message);
                            return done(message);
                        }
                        credentials.object.nick = updated.object.nick;
                        credentials.actor.id = updated.actor.id;
                        credentials.actor.name = updated.actor.name;
                        this.credentials = updated;
                        // The previous nick now belongs to whoever takes it next.
                        // Leaving it here drops their traffic: an event whose
                        // actor is in this set completes a job instead of being
                        // delivered.
                        this.handledActors.delete(job.actor.id);
                        this.handledActors.add(credentials.actor.id);
                        done();
                    },
                });
                // send nick change command
                client.raw(["NICK", job.target.name]);
            } else if (job.object.type === "topic") {
                // update topic
                const channel = this.resolveIrcTarget(job.target);
                if (!channel) {
                    return done(
                        "IRC room targets must be server-qualified as '#channel@server'",
                    );
                }
                this.log.debug(`changing topic in channel ${channel}`);
                this.jobQueue.push({ ack: "pong", handler: done });
                client.raw(["topic", channel, job.object.content]);
            } else {
                return done(`unknown update action: ${job.object.type}`);
            }
            client.raw(`PING ${job.actor.name}`);
        });
    }

    /**
     * Function: query
     *
     * Indicate an intent to query something (e.g. get a list of users in a room).
     *
     * @param {object} job activity streams object
     * @param {object} done callback when job is done
     */
    query(job: ActivityStream, done: PlatformCallback) {
        this.log.debug(`query() called for ${job.actor.id}`);
        const lineBreakError = ircLineBreakError([
            job.target?.name,
            job.target?.id,
        ]);
        if (lineBreakError) return done(lineBreakError);
        this.getClient(job.actor.id, false, (err, client) => {
            if (err) {
                return done(err);
            }

            if (job.object.type === "attendance") {
                // `resolveIrcTarget` returns null for a bare (non
                // server-qualified) room target, so we never emit a bare
                // `NAMES` (no channel argument): IRC servers answer that with
                // the entire network channel list, flooding the client with
                // presence for rooms it never joined. See
                // sockethub/sockethub#1085.
                const channel = this.resolveIrcTarget(job.target);
                if (!channel) {
                    return done(
                        "IRC room targets must be server-qualified as '#channel@server'",
                    );
                }
                this.log.debug(`query() - sending NAMES for ${channel}`);
                client.raw(["NAMES", channel]);
                done();
            } else {
                done(`unknown 'type' '${job.object.type}'`);
            }
        });
    }

    /**
     * Disconnect IRC client
     * @param {object} job activity streams object
     * @param done
     */
    disconnect(job: ActivityStream, done: PlatformCallback) {
        this.log.debug(`disconnect called for ${job.actor.id}`);
        this.cleanup(done);
    }

    cleanup(done: PlatformCallback) {
        this.log.debug("cleanup() called");
        this.initialized = false;
        this.pongAcksToSkip = 0;
        this.forceDisconnect = true;
        if (typeof this.client === "object") {
            if (typeof this.client.end === "function") {
                this.client.end();
            }
        }
        this.client = undefined;
        return done();
    }

    //
    // Private methods
    //

    /**
     * Resolve an activity target to its IRC recipient (channel or nick).
     *
     * Targets are server-qualified for consistency with what the platform emits
     * (see irc2as): rooms are addressed as `#channel@server` and users
     * (private messages) as
     * `nick@server` — the same `@server` suffix for both. Returns `null` for a
     * `room` target that isn't server-qualified (a bare channel), which callers
     * reject — bare channel names are no longer accepted.
     *
     * @param target activity stream target (`job.target`)
     * @returns the IRC channel (`#channel`) or nick, or `null` for a bare room
     */
    private resolveIrcTarget(target?: {
        id?: string;
        name?: string;
        type?: string;
    }): string | null {
        const id = target?.id ?? "";
        const at = id.lastIndexOf("@");
        if (target?.type === "room") {
            if (at <= 0 || !id.startsWith("#") || at === id.length - 1) {
                // bare channel (no server) — rejected for consistency with inbound
                return null;
            }
            // #channel@server -> #channel. Splitting at the final `@` preserves
            // any `@` characters that are part of the IRC channel name.
            return id.slice(0, at);
        }
        // nick@server -> nick (private message); otherwise pass through
        return at !== -1 ? id.slice(0, at) : id;
    }

    private isJoined(channel: string) {
        if (channel.indexOf("#") === 0) {
            // valid channel name
            return this.channels.has(channel);
        }

        // usernames are always OK to send to
        return true;
    }

    private hasJoined(channel: string) {
        this.log.debug(`joined ${channel}`);
        // keep track of channels joined
        if (!this.channels.has(channel)) {
            this.channels.add(channel);
        }
    }

    private hasLeft(channel: string) {
        this.log.debug(`left ${channel}`);
        // keep track of channels left
        if (this.channels.has(channel)) {
            this.channels.delete(channel);
        }
    }

    private getClient(
        key: string,
        credentials: PlatformIrcCredentialsObject | false,
        cb: GetClientCallback,
    ) {
        this.log.debug(
            `getClient called, connecting: ${this.clientConnecting}`,
        );
        if (this.client) {
            this.handledActors.add(key);
            return cb(null, this.client);
        }

        if (this.clientConnecting) {
            // client is in the process of connecting, wait
            setTimeout(() => {
                if (this.client) {
                    this.log.debug(
                        `resolving delayed getClient call for ${key}`,
                    );
                    this.handledActors.add(key);
                    return cb(null, this.client);
                }
                return cb("failed to get irc client, please try again.");
            }, this.config.connectTimeoutMs);
            return;
        }

        if (!credentials) {
            return cb(
                "no client found, and no credentials specified. you must connect first",
            );
        }

        this.ircConnect(credentials, (err, client) => {
            if (err) {
                this.initialized = false;
                return cb(err);
            }
            this.handledActors.add(key);
            this.client = client;
            this.credentials = credentials;
            this.registerListeners(credentials.object.server);
            this.initialized = true;
            return cb(null, client);
        });
    }

    private ircConnect(
        credentials: PlatformIrcCredentialsObject,
        cb: GetClientCallback,
    ) {
        const lineBreakError = ircLineBreakError([
            credentials.object.nick,
            credentials.object.username,
            credentials.actor.name,
        ]);
        if (lineBreakError) return cb(lineBreakError);

        this.clientConnecting = true;
        const is_secure =
            typeof credentials.object.secure === "boolean"
                ? credentials.object.secure
                : true;
        const sasl_secret =
            credentials.object.token || credentials.object.password;
        // saslMechanism must be set explicitly when using token. The schema
        // enforces this via allOf/anyOf constraints (PLAIN requires
        // password or token, OAUTHBEARER requires token). The runtime
        // fallback only applies to the password-only path where
        // saslMechanism was omitted.
        const sasl_mechanism: "PLAIN" | "OAUTHBEARER" =
            credentials.object.saslMechanism || "PLAIN";
        const is_sasl =
            typeof credentials.object.sasl === "boolean"
                ? credentials.object.sasl
                : !!sasl_secret;

        const module_options: IrcSocketOptions = {
            username: credentials.object.username || credentials.object.nick,
            nicknames: [credentials.object.nick],
            server: credentials.object.server || "irc.libera.chat",
            realname: credentials.actor.name || credentials.object.nick,
            port: credentials.object.port
                ? typeof credentials.object.port === "string"
                    ? Number.parseInt(credentials.object.port, 10)
                    : credentials.object.port
                : is_secure
                  ? 6697
                  : 6667,
            debug: console.log,
        };
        if (is_secure) {
            // Validate the server's TLS certificate by default. Only disable
            // validation when the caller explicitly opts in via
            // `allowInvalidCert` (e.g. for self-signed IRC networks). See #1056.
            module_options.connectOptions = {
                rejectUnauthorized: !credentials.object.allowInvalidCert,
            };
        }
        if (is_sasl) {
            module_options.saslMechanism = sasl_mechanism;
            module_options.saslPassword = sasl_secret;
            module_options.capabilities = { requires: ["sasl"] };
        }

        this.log.debug(
            `attempting to connect to ${module_options.server}:${module_options.port} transport: ${
                is_secure ? "secure" : "clear"
            } sasl: ${is_sasl}${is_sasl ? ` (${sasl_mechanism})` : ""}`,
        );

        const client = new IrcSocket(
            module_options,
            is_secure ? tlsTransport : net,
        );

        // The close/error/timeout listeners stay attached for the life of
        // the socket. The connect callback may run only once; a later close
        // (including one we initiate after a nick we could not store) must
        // not complete that original connect job a second time.
        let settled = false;
        const forceDisconnect = (err: string) => {
            this.forceDisconnect = true;
            this.clientConnecting = false;
            if (settled) {
                this.releaseConnection(err);
                return;
            }
            settled = true;
            if (client && typeof client.end === "function") {
                client.end();
            }
            if (
                this.client &&
                this.client !== client &&
                typeof this.client.end === "function"
            ) {
                this.client.end();
            }
            cb(err);
        };

        client.once("error", (err: string) => {
            this.log.debug(`irc client 'error' occurred.`, { err });
            forceDisconnect("error connecting to server.");
        });

        client.once("close", () => {
            this.log.debug(`irc client 'close' event fired.`);
            forceDisconnect("connection to server closed.");
        });

        client.once("timeout", () => {
            this.log.debug("timeout occurred, force-disconnect");
            forceDisconnect("connection timeout to server.");
        });

        client.connect().then((res: IrcSocketConnectResponse) => {
            if (settled) {
                return;
            }
            if (res.isFail()) {
                settled = true;
                return cb(`unable to connect to server: ${res.fail()}`);
            }
            const capabilities = res.ok();
            this.clientConnecting = false;
            if (this.forceDisconnect) {
                settled = true;
                client.end();
                return cb("force disconnect active, aborting connect.");
            }
            settled = true;

            this.log.debug(
                `connected to ${module_options.server} capabilities: `,
                { capabilities },
            );
            return cb(null, client);
        });
    }

    private completeJob(err?: string) {
        this.log.debug(`completing job, queue count: ${this.jobQueue.length}`);
        const job = this.jobQueue.shift();
        if (job && typeof job.handler === "function") {
            job.handler(err);
        } else if (this.jobQueue.length === 0) {
            this.log.debug(
                "WARNING: job completion event received with an empty job queue.",
            );
        } else {
            this.log.debug(
                `WARNING: job completion found non-function in queue (${typeof job?.handler}), ${this.jobQueue.length} items remain.`,
            );
        }
    }

    private isNickAck(asObject: ActivityStream): boolean {
        return (
            asObject.type === "update" && asObject.object?.type === "address"
        );
    }

    private async adoptForcedNickChange(asObject: ActivityStream) {
        if (
            !this.credentials ||
            typeof asObject.target?.name !== "string" ||
            typeof asObject.actor?.id !== "string"
        ) {
            this.log.debug(`calling sendToClient for ${asObject.actor.id}`, [
                ...this.handledActors.keys(),
            ]);
            this.sendToClient(asObject);
            return;
        }

        const oldActorId = asObject.actor.id;
        const newNick = asObject.target.name;
        const server = this.credentials.object.server;
        const updated = structuredClone(this.credentials);
        updated.object.nick = newNick;
        updated.actor.id = `${newNick}@${server}`;
        updated.actor.name = newNick;

        try {
            await this.updateActor(updated);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.log.error("failed to adopt forced nick change", err);
            // The server already moved this connection. Reporting the rename
            // as a success makes the client retarget its replay state at the
            // new actor and, on the next reconnect, overwrite the account
            // stored there. The previous nick is free; leaving it in
            // handledActors adopts whoever takes it next, including their
            // nick changes. Drop the socket instead.
            this.sendToClient({ ...asObject, error: message });
            this.releaseConnection(message);
            return;
        }

        this.credentials = updated;
        this.handledActors.delete(oldActorId);
        this.handledActors.add(updated.actor.id);

        this.log.debug(`calling sendToClient for ${asObject.actor.id}`, [
            ...this.handledActors.keys(),
        ]);
        this.sendToClient(asObject);
    }

    /**
     * Forget the live IRC socket after a nick the server applied could not
     * be stored. In-flight commands are failed so they do not wait on a
     * PONG from a socket we are closing.
     */
    private releaseConnection(reason: string) {
        if (this.releasing) {
            return;
        }
        this.releasing = true;
        this.initialized = false;
        this.clientConnecting = false;
        this.pongAcksToSkip = 0;
        this.handledActors.clear();
        this.channels.clear();
        const client = this.client;
        this.client = undefined;
        while (this.jobQueue.length > 0) {
            this.completeJob(reason);
        }
        if (client && typeof client.end === "function") {
            try {
                client.end();
            } catch (closeErr) {
                this.log.error(
                    "failed to close IRC socket after nick change",
                    closeErr,
                );
            }
        }
        this.releasing = false;
    }

    private registerListeners(server: string) {
        this.irc2as = new IrcToActivityStreams({
            server: server,
            contexts: buildCanonicalContext(this.schema.contextUrl),
        });
        this.client.on("data", (data: unknown) => {
            this.irc2as.input(data);
        });

        this.irc2as.events.on("incoming", (asObject: ActivityStream) => {
            const fromThisConnection =
                typeof asObject.actor === "object" &&
                typeof asObject.actor.name === "string" &&
                this.handledActors.has(asObject.actor.id);
            // Only a matching nick-change acknowledgement completes a
            // nickAck job. Other self-originated traffic (for example a
            // server-forced rename while a send waits on PONG) must still be
            // delivered.
            if (fromThisConnection && this.isNickAck(asObject)) {
                if (this.jobQueue[0]?.ack === "nickAck") {
                    // NICK is followed by a PING, but this echo completes the
                    // job before that PONG arrives. The next command can
                    // already be waiting on a PONG of its own; leaving this
                    // one outstanding would acknowledge that command with
                    // success. Same leftover-PONG race as a numeric error.
                    this.pongAcksToSkip += 1;
                    this.completeJob();
                    return;
                }
                void this.adoptForcedNickChange(asObject);
                return;
            }
            this.log.debug(`calling sendToClient for ${asObject.actor.id}`, [
                ...this.handledActors.keys(),
            ]);
            this.sendToClient(asObject);
        });

        this.irc2as.events.on("unprocessed", (s: string) => {
            this.log.debug(`unprocessed irc message:> ${s}`);
        });

        // The generated eslint error expects that the `error` event is propagating an Error object
        // however for irc2as this event delivers an AS object of type `error`.

        this.irc2as.events.on("error", (asObject: ActivityStream) => {
            const message = ircFailureMessage(asObject);
            this.log.debug(`message error response ${message}`);
            if (this.jobQueue.length > 0) {
                // join, send, topic, and nick each write a PING after queueing.
                // The numeric reply arrives first, so this PONG is still in
                // flight. On a remote server it lands after the worker has
                // already started the next queued command, and it would
                // complete that command with success.
                this.pongAcksToSkip += 1;
                this.completeJob(message);
            }
        });

        this.irc2as.events.on("pong", (timestamp: string) => {
            this.log.debug(`received PONG at ${timestamp}`);
            if (this.pongAcksToSkip > 0) {
                this.pongAcksToSkip -= 1;
                return;
            }
            if (this.jobQueue[0]?.ack === "pong") {
                this.completeJob();
            }
        });

        this.irc2as.events.on("ping", (timestamp: string) => {
            this.log.debug(`received PING at ${timestamp}`);
            this.client?.raw("PONG");
        });
    }
}

export default IRC;
