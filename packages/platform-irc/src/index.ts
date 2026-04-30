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

export type GetClientCallback = (
    err: string | null,
    client?: IrcSocketInstance,
) => void;

type JobQueueHandler = (err?: Error | string) => void | Promise<void>;

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
    private readonly sendToClient: PlatformSendToClient;
    private irc2as!: IrcToActivityStreams;
    private forceDisconnect = false;
    private clientConnecting = false;
    private initialized = false;
    private client?: IrcSocketInstance;
    private jobQueue: Array<JobQueueHandler> = []; // list of handlers to confirm when message delivery confirmed
    private channels = new Set();
    private handledActors = new Set();

    constructor(session: PlatformSession) {
        this.log = session.log;
        this.sendToClient = session.sendToClient;
        this.updateActor = session.updateActor;
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
        this.getClient(job.actor.id, false, (err, client) => {
            if (err) {
                return done(err);
            }
            if (this.channels.has(job.target.name)) {
                this.log.debug(`channel ${job.target.name} already joined`);
                return done();
            }
            // join channel
            this.jobQueue.push(() => {
                this.hasJoined(job.target.name);
                done();
            });
            this.log.debug(`sending join ${job.target.name}`);
            client.raw(["JOIN", job.target.name]);
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
        this.getClient(job.actor.id, false, (err, client) => {
            if (err) {
                return done(err);
            }
            // leave channel
            this.hasLeft(job.target.name);
            client.raw(["PART", job.target.name]);
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
        this.getClient(job.actor.id, false, async (err, client) => {
            if (err) {
                return done(err);
            }

            if (typeof job.object.content !== "string") {
                return done("cannot send message with no object.content");
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
                // jsdoc does not like this octal escape sequence, but it's needed for proper behavior in IRC
                // so the following line needs to be commented out when the API doc is built.
                // investigate:
                // https://github.com/jsdoc2md/jsdoc-to-markdown/issues/197#issuecomment-976851915
                const { default: buildCommand } = await import(
                    "./octal-hack.js"
                );
                const message = buildCommand(job.object.content);
                // biome-ignore lint/style/useTemplate: IRC raw command formatting
                client.raw("PRIVMSG " + job.target.name + " :" + message);
                return done("IRC commands temporarily disabled");
            }
            if (job.object.type === "notice") {
                // attempt to send as raw command
                client.raw(`NOTICE ${job.target.name} :${job.object.content}`);
            } else if (this.isJoined(job.target.name)) {
                client.raw(`PRIVMSG ${job.target.name} :${job.object.content}`);
            } else {
                return done(
                    "cannot send message to a channel of which you've not first joined.",
                );
            }
            this.jobQueue.push(done);
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
        this.getClient(job.actor.id, false, (err, client) => {
            if (err) {
                return done(err);
            }
            if (job.object.type === "address") {
                this.log.debug(
                    `changing nick from ${job.actor.name} to ${job.target.name}`,
                );
                this.handledActors.add(job.target.id);
                this.jobQueue.push(async (err: Error) => {
                    if (err) {
                        this.handledActors.delete(job.target.id);
                        return done(err);
                    }
                    credentials.object.nick = job.target.name;
                    credentials.actor.id = `${job.target.name}@${credentials.object.server}`;
                    credentials.actor.name = job.target.name;
                    await this.updateActor(credentials);
                    done();
                });
                // send nick change command
                client.raw(["NICK", job.target.name]);
            } else if (job.object.type === "topic") {
                // update topic
                this.log.debug(`changing topic in channel ${job.target.name}`);
                this.jobQueue.push(done);
                client.raw(["topic", job.target.name, job.object.content]);
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
        this.getClient(job.actor.id, false, (err, client) => {
            if (err) {
                return done(err);
            }

            if (job.object.type === "attendance") {
                this.log.debug(
                    `query() - sending NAMES for ${job.target.name}`,
                );
                client.raw(["NAMES", job.target.name]);
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
            this.registerListeners(credentials.object.server);
            this.initialized = true;
            return cb(null, client);
        });
    }

    private ircConnect(
        credentials: PlatformIrcCredentialsObject,
        cb: GetClientCallback,
    ) {
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
            module_options.connectOptions = { rejectUnauthorized: false };
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

        const client = new IrcSocket(module_options, is_secure ? tls : net);

        const forceDisconnect = (err: string) => {
            this.forceDisconnect = true;
            this.clientConnecting = false;
            if (client && typeof client.end === "function") {
                client.end();
            }
            if (this.client && typeof this.client.end === "function") {
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
            if (res.isFail()) {
                return cb(`unable to connect to server: ${res.fail()}`);
            }
            const capabilities = res.ok();
            this.clientConnecting = false;
            if (this.forceDisconnect) {
                client.end();
                return cb("force disconnect active, aborting connect.");
            }

            this.log.debug(
                `connected to ${module_options.server} capabilities: `,
                { capabilities },
            );
            return cb(null, client);
        });
    }

    private completeJob(err?: string) {
        this.log.debug(`completing job, queue count: ${this.jobQueue.length}`);
        const done = this.jobQueue.shift();
        if (typeof done === "function") {
            done(err);
        } else if (this.jobQueue.length === 0) {
            this.log.debug(
                "WARNING: job completion event received with an empty job queue.",
            );
        } else {
            this.log.debug(
                `WARNING: job completion found non-function in queue (${typeof done}), ${this.jobQueue.length} items remain.`,
            );
        }
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
            if (
                typeof asObject.actor === "object" &&
                typeof asObject.actor.name === "string" &&
                this.handledActors.has(asObject.actor.id)
            ) {
                this.completeJob();
            } else {
                this.log.debug(
                    `calling sendToClient for ${asObject.actor.id}`,
                    [...this.handledActors.keys()],
                );
                this.sendToClient(asObject);
            }
        });

        this.irc2as.events.on("unprocessed", (s: string) => {
            this.log.debug(`unprocessed irc message:> ${s}`);
        });

        // The generated eslint error expects that the `error` event is propagating an Error object
        // however for irc2as this event delivers an AS object of type `error`.

        this.irc2as.events.on("error", (asObject: ActivityStream) => {
            this.log.debug(`message error response ${asObject.object.content}`);
            this.completeJob(asObject.object.content);
        });

        this.irc2as.events.on("pong", (timestamp: string) => {
            this.log.debug(`received PONG at ${timestamp}`);
            this.completeJob();
        });

        this.irc2as.events.on("ping", (timestamp: string) => {
            this.log.debug(`received PING at ${timestamp}`);
            this.client.raw("PONG");
        });
    }
}

export default IRC;
