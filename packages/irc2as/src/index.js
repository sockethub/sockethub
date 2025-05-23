import events from "node:events";
import debug from "debug";
import { ASEmitter } from "./as-emitter.js";

const log = debug("irc2as");

const EVENT_INCOMING = "incoming";
// EVENT_ERROR = 'error',
const EVENT_PONG = "pong";
const EVENT_PING = "ping";
const EVENT_UNPROCESSED = "unprocessed";

const ERR_BAD_NICK = "432";
const ERR_CHAN_PRIVS = "482";
const ERR_NICK_IN_USE = "433";
const ERR_TEMP_UNAVAIL = "437";
const ERR_NO_CHANNEL = "403";
const ERR_NOT_INVITED = "471";
const ERR_BADMODE = "472";
const ERR_INVITE_ONLY = "473";
const ERR_BANNED = "474";
const ERR_BADKEY = "475";
const ERR_BADMASK = "476";
const ERR_NOCHANMODES = "477";
const ERR_BANLISTFULL = "478";
const JOIN = "JOIN";
const MODE = "MODE";
const MOTD = "372";
const MOTD_END = "376";
const NAMES = "353";
// NAMES_END = "366",
const NICK = "NICK";
const NOTICE = "NOTICE";
const PART = "PART";
const PING = "PING";
const PONG = "PONG";
const PRIVMSG = "PRIVMSG";
const QUIT = "QUIT";
const TOPIC_CHANGE = "TOPIC";
const TOPIC_IS = "332";
const TOPIC_SET_BY = "333";
const WHO = "352";
const WHO_OLD = "354";
// WHO_END = "315";

const ROLE = {
    "@": "owner",
    "%": "admin",
    "*": "participant",
};

const MODES = {
    o: "owner",
    h: "admin",
    v: "participant",
};

function getNickFromServer(server) {
    return server.split(/^:/)[1].split("!")[0];
}

export class IrcToActivityStreams {
    constructor(cfg) {
        const config = cfg || {};
        this.server = config.server;
        this.events = new events.EventEmitter();
        this.__buffer = {};
        this.__buffer[NAMES] = {};
    }

    input(payload) {
        log(payload);
        if (typeof payload !== "string") {
            log("unable to process incoming message as it was not a string.");
            return false;
        }
        if (payload.length < 3) {
            log("unable to process incoming string, length smaller than 3.");
            return false;
        }
        const incoming = payload.trim();
        const [metadata, content] = incoming.split(" :");
        const [server, code, pos1, pos2, pos3, ...msg] = metadata.split(" ");
        const channel =
            typeof pos1 === "string" && pos1.startsWith("#")
                ? pos1
                : typeof pos2 === "string" && pos2.startsWith("#")
                  ? pos2
                  : typeof pos3 === "string" && pos3.startsWith("#")
                    ? pos3
                    : undefined;
        if (metadata === PING) {
            this.events.emit(EVENT_PING, `${Date.now()}`);
            return true;
        }
        log(
            `[${code}] server: ${server} channel: ${channel} 1: ${pos1}, 2: ${pos2}, 3: ${pos3}. content: `,
            content,
        );
        this.__processIRCCodes(
            code,
            server,
            channel,
            pos1,
            pos2,
            pos3,
            content,
            msg,
            incoming,
        );
    }

    __processIRCCodes(
        code,
        server,
        channel,
        pos1,
        pos2,
        pos3,
        content,
        msg,
        incoming,
    ) {
        const ase = new ASEmitter(this.events, this.server);
        let nick;
        let type;
        let role;

        switch (code) {
            /** */
            case ERR_CHAN_PRIVS:
            case ERR_NOT_INVITED:
            case ERR_BADMODE:
            case ERR_INVITE_ONLY:
            case ERR_BANNED:
            case ERR_BADKEY:
            case ERR_BADMASK:
            case ERR_NOCHANMODES:
            case ERR_BANLISTFULL:
                ase.channelError(channel, pos1, content);
                break;

            /** */
            case ERR_NICK_IN_USE: // nick conflict
            case ERR_BAD_NICK:
                ase.serviceError(pos2, content);
                break;

            /** */
            case ERR_NO_CHANNEL: // no such channel
                ase.joinError(pos2);
                break;

            /** */
            case ERR_TEMP_UNAVAIL: // nick conflict
                ase.nickError(pos2, content);
                break;

            /** */
            case JOIN: // room join
                ase.joinRoom(channel, getNickFromServer(server));
                break;

            // custom event indicating a channel mode has been updated, used to re-query user or channel
            case MODE: {
                const user_mode = pos2 || content;
                if (!channel) {
                    break;
                } // don't handle cases with no channel defined
                if (!pos3) {
                    break;
                } // we need target user
                role = MODES[user_mode[1]] || "member";
                type = "add";
                if (user_mode[0] === "-") {
                    type = "remove";
                }
                ase.role(type, getNickFromServer(server), pos3, role, channel);
                break;
            }

            /** */
            case MOTD: // MOTD
                if (!this.__buffer[MOTD]) {
                    this.__buffer[MOTD] = {
                        context: "irc",
                        type: "update",
                        actor: {
                            type: "service",
                            id: this.server,
                            name: this.server,
                        },
                        object: {
                            type: "topic",
                            content: content,
                        },
                    };
                } else {
                    this.__buffer[MOTD].object.content += ` ${content}`;
                }
                break;
            case MOTD_END: // end of MOTD
                if (!this.__buffer[MOTD]) {
                    break;
                }
                ase.emitEvent(EVENT_INCOMING, this.__buffer[MOTD]);
                delete this.__buffer[MOTD];
                break;

            /** */
            case NAMES: // user list
                for (const entry of content.split(" ")) {
                    role = "member";
                    let username = entry;
                    if (ROLE[entry[0]]) {
                        username = entry.substr(1);
                        role = ROLE[entry[0]];
                    }
                    ase.presence(username, role, channel);
                }
                break;

            /** */
            case NICK: // nick change
                // log(`- 2 nick: ${nick} from content: ${content}`);
                ase.nickChange(getNickFromServer(server), content);
                break;

            /** */
            case NOTICE: // notice
                ase.notice(pos1, content);
                break;

            /** */
            case PART: // leaving
                ase.userPart(channel, getNickFromServer(server));
                break;

            /** */
            case PONG: // ping response received
                this.events.emit(EVENT_PONG, `${Date.now()}`);
                break;

            /** */
            case PRIVMSG: // msg
                ase.privMsg(getNickFromServer(server), pos1, content);
                break;

            /** */
            case QUIT: // quit user
                ase.userQuit(getNickFromServer(server));
                break;

            /** */
            case TOPIC_CHANGE: // topic changed now
                ase.topicChange(channel, getNickFromServer(server), content);
                break;

            /** */
            case TOPIC_IS: // topic currently set to
                this.__buffer[TOPIC_IS] = {
                    context: "irc",
                    type: "update",
                    actor: undefined,
                    target: {
                        type: "room",
                        id: `${this.server}/${channel}`,
                        name: channel,
                    },
                    object: {
                        type: "topic",
                        content: content,
                    },
                };
                break;
            case TOPIC_SET_BY: // current topic set by
                if (!this.__buffer[TOPIC_IS]) {
                    break;
                }
                nick = pos3.split("!")[0];
                this.__buffer[TOPIC_IS].actor = {
                    type: "person",
                    id: `${nick}@${this.server}`,
                    name: nick,
                };
                this.__buffer[TOPIC_IS].published = msg[0];
                ase.emitEvent(EVENT_INCOMING, this.__buffer[TOPIC_IS]);
                delete this.__buffer[TOPIC_IS];
                break;

            /** */
            case WHO:
            case WHO_OLD:
                nick = msg[3].length <= 2 ? msg[2] : msg[3];
                if (nick === "undefined") {
                    break;
                }
                role = MODES[pos2[1]] || "member";
                ase.presence(nick, role, channel);
                break;

            /** */
            default:
                this.events.emit(EVENT_UNPROCESSED, incoming);
                break;
        }
    }
}
