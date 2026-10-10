const EVENT_INCOMING = "incoming";
const EVENT_ERROR = "error";
const EVENT_CTCP = "ctcp";

// CTCP frames a command and optional argument in \u0001 delimiters. Servers
// with the legacy `identify-msg` capability (freenode-era) prefix the
// payload with "+" or "-"; modern servers send the bare framing. The closing
// delimiter is optional on input: servers truncate over-long lines, which
// can drop it, and the CTCP spec says parsers should accept its absence.
// biome-ignore lint/suspicious/noControlCharactersInRegex: CTCP framing uses control chars
const CTCP_FRAME = /^[+-]?\u0001([^\u0001 ]+)(?: ([\s\S]*?))?\u0001?$/;

/**
 * Returns `{ command, args }` when `content` is a CTCP frame, else null.
 * The command is upper-cased so callers can match it directly.
 */
function parseCtcp(content) {
    const match = CTCP_FRAME.exec(content);
    if (!match) {
        return null;
    }
    return { command: match[1].toUpperCase(), args: match[2] ?? "" };
}

export class ASEmitter {
    constructor(events, server, contexts) {
        if (!Array.isArray(contexts) || contexts.length === 0) {
            throw new Error(
                "ASEmitter requires a non-empty contexts array from the caller",
            );
        }
        this.server = server;
        this.events = events;
        this.contexts = [...contexts];
    }

    emitEvent(code, asObject) {
        if (typeof asObject === "object" && !asObject.published) {
            asObject.published = new Date().toISOString();
        }
        this.events.emit(code, asObject);
    }

    __generalError(nick, content) {
        return {
            "@context": this.contexts,
            type: "update",
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            target: {
                type: "service",
                id: this.server,
            },
            error: content,
        };
    }

    presence(nick, role, channel) {
        this.emitEvent(EVENT_INCOMING, {
            "@context": this.contexts,
            type: "update",
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            target: {
                type: "room",
                id: `${channel}@${this.server}`,
                name: channel,
            },
            object: {
                type: "presence",
                role: role,
            },
        });
    }

    attendance(channel, nick, members) {
        this.emitEvent(EVENT_INCOMING, {
            "@context": this.contexts,
            type: "query",
            actor: {
                type: "room",
                id: `${channel}@${this.server}`,
                name: channel,
            },
            target: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            object: {
                type: "attendance",
                members: members,
            },
        });
    }

    channelError(channel, nick, content) {
        this.emitEvent(EVENT_ERROR, {
            "@context": this.contexts,
            type: "update",
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
            },
            target: {
                type: "room",
                id: `${channel}@${this.server}`,
            },
            error: content,
        });
    }

    nickError(nick, content) {
        this.emitEvent(EVENT_ERROR, this.__generalError(nick, content));
    }

    notice(nick, content, from) {
        // A CTCP frame in a NOTICE is the reply to a request we sent. It
        // is not a chat message, so never hand it to the client as one.
        const ctcp = parseCtcp(content);
        if (ctcp) {
            this.ctcp("reply", from, nick, ctcp);
            return;
        }
        this.emitEvent(EVENT_INCOMING, {
            "@context": this.contexts,
            type: "send",
            actor: {
                type: "service",
                id: this.server,
            },
            object: {
                type: "message",
                content: content,
            },
            target: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
        });
    }

    serviceError(nick, content) {
        this.emitEvent(EVENT_ERROR, this.__generalError(nick, content));
    }

    joinError(nick) {
        this.emitEvent(EVENT_ERROR, {
            "@context": this.contexts,
            type: "join",
            actor: {
                id: this.server,
                type: "service",
            },
            error: `no such channel ${nick}`,
            target: {
                id: `${nick}@${this.server}`,
                type: "person",
            },
        });
    }

    topicChange(channel, nick, content) {
        this.emitEvent(EVENT_INCOMING, {
            "@context": this.contexts,
            type: "update",
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            target: {
                type: "room",
                id: `${channel}@${this.server}`,
                name: channel,
            },
            object: {
                type: "topic",
                content: content,
            },
        });
    }

    joinRoom(channel, nick) {
        this.emitEvent(EVENT_INCOMING, {
            "@context": this.contexts,
            type: "join",
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            target: {
                type: "room",
                id: `${channel}@${this.server}`,
                name: channel,
            },
        });
    }

    userQuit(nick) {
        this.emitEvent(EVENT_INCOMING, {
            "@context": this.contexts,
            type: "leave",
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            target: {
                type: "service",
                id: this.server,
            },
            object: {
                type: "message",
                content: "user has quit",
            },
        });
    }

    userPart(channel, nick) {
        this.emitEvent(EVENT_INCOMING, {
            "@context": this.contexts,
            type: "leave",
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            target: {
                type: "room",
                id: `${channel}@${this.server}`,
                name: channel,
            },
            object: {
                type: "message",
                content: "user has left the channel",
            },
        });
    }

    privMsg(nick, target, content) {
        let type;
        let message;
        const ctcp = parseCtcp(content);
        if (ctcp?.command === "ACTION") {
            // CTCP ACTION (/me) is the one CTCP command that is a chat
            // message.
            type = "me";
            message = ctcp.args;
        } else if (ctcp) {
            // Any other CTCP frame in a PRIVMSG (VERSION, PING, TIME...) is a
            // request aimed at the client software, not at the user. Passing
            // it on as a message leaks raw control characters to the client
            // and opens a phantom conversation with the sender (#551).
            this.ctcp("request", nick, target, ctcp);
            return;
        } else {
            type = "message";
            message = content;
        }
        this.emitEvent(EVENT_INCOMING, {
            "@context": this.contexts,
            type: "send",
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            target: {
                type: target.startsWith("#") ? "room" : "person",
                id: `${target}@${this.server}`,
                name: target,
            },
            object: {
                type: type,
                content: message,
            },
        });
    }

    /**
     * Emits a non-ACTION CTCP frame on the `ctcp` event. `kind` is "request"
     * for a PRIVMSG and "reply" for a NOTICE.
     */
    ctcp(kind, from, target, { command, args }) {
        this.events.emit(EVENT_CTCP, {
            kind: kind,
            command: command,
            args: args,
            from: from,
            target: target,
        });
    }

    role(type, nick, target, role, channel) {
        this.emitEvent(EVENT_INCOMING, {
            "@context": this.contexts,
            type: type,
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            target: {
                type: "person",
                id: `${target}@${this.server}`,
                name: target,
            },
            object: {
                type: "relationship",
                relationship: "role",
                subject: {
                    type: "presence",
                    role: role,
                },
                object: {
                    type: "room",
                    id: `${channel}@${this.server}`,
                    name: channel,
                },
            },
        });
    }

    nickChange(nick, content) {
        this.emitEvent(EVENT_INCOMING, {
            "@context": this.contexts,
            type: "update",
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            target: {
                type: "person",
                id: `${content}@${this.server}`,
                name: content,
            },
            object: {
                type: "address",
            },
        });
    }
}
