const EVENT_INCOMING = "incoming",
    EVENT_ERROR = "error";

interface EventEmitter {
    emit(code: string, asObject: any): void;
}

export class ASEmitter {
    server: string;
    events: EventEmitter

    constructor(events: EventEmitter, server: string) {
        this.server = server;
        this.events = events;
    }

    emitEvent(code: string, asObject) {
        if (typeof asObject === "object" && !asObject.published) {
            asObject.published = `${Date.now()}`;
        }
        this.events.emit(code, asObject);
    }

    private generalError(nick: string, content: string) {
        return {
            context: "irc",
            type: "update",
            actor: {
                type: "person",
                id: nick + "@" + this.server,
                name: nick,
            },
            target: {
                type: "service",
                id: this.server,
            },
            error: content,
        };
    }

    presence(nick: string, role: string, channel: string) {
        this.emitEvent(EVENT_INCOMING, {
            context: "irc",
            type: "update",
            actor: {
                type: "person",
                id: `${nick}@${this.server}`,
                name: nick,
            },
            target: {
                type: "room",
                id: this.server + "/" + channel,
                name: channel,
            },
            object: {
                type: "presence",
                role: role,
            },
        });
    }

    channelError(channel: string, nick: string, content) {
        this.emitEvent(EVENT_ERROR, {
            context: "irc",
            type: "update",
            actor: {
                type: "person",
                id: nick + "@" + this.server,
            },
            target: {
                type: "room",
                id: this.server + "/" + channel,
            },
            error: content,
        });
    }

    nickError(nick: string, content) {
        this.emitEvent(EVENT_ERROR, this.generalError(nick, content));
    }

    notice(nick: string, content) {
        this.emitEvent(EVENT_INCOMING, {
            context: "irc",
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
                id: nick + "@" + this.server,
                name: nick,
            },
        });
    }

    serviceError(nick: string, content) {
        this.emitEvent(EVENT_ERROR, this.generalError(nick, content));
    }

    joinError(nick) {
        this.emitEvent(EVENT_ERROR, {
            context: "irc",
            type: "join",
            actor: {
                id: this.server,
                type: "service",
            },
            error: "no such channel " + nick,
            target: {
                id: nick + "@" + this.server,
                type: "person",
            },
        });
    }

    topicChange(channel: string, nick: string, content) {
        this.emitEvent(EVENT_INCOMING, {
            context: "irc",
            type: "update",
            actor: {
                type: "person",
                id: nick + "@" + this.server,
                name: nick,
            },
            target: {
                type: "room",
                id: this.server + "/" + channel,
                name: channel,
            },
            object: {
                type: "topic",
                content: content,
            },
        });
    }

    joinRoom(channel: string, nick: string) {
        this.emitEvent(EVENT_INCOMING, {
            context: "irc",
            type: "join",
            actor: {
                type: "person",
                id: nick + "@" + this.server,
                name: nick,
            },
            target: {
                type: "room",
                id: this.server + "/" + channel,
                name: channel,
            },
        });
    }

    userQuit(nick: string) {
        this.emitEvent(EVENT_INCOMING, {
            context: "irc",
            type: "leave",
            actor: {
                type: "person",
                id: nick + "@" + this.server,
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

    userPart(channel: string, nick: string) {
        this.emitEvent(EVENT_INCOMING, {
            context: "irc",
            type: "leave",
            actor: {
                type: "person",
                id: nick + "@" + this.server,
                name: nick,
            },
            target: {
                type: "room",
                id: this.server + "/" + channel,
                name: channel,
            },
            object: {
                type: "message",
                content: "user has left the channel",
            },
        });
    }

    privMsg(nick: string, target: string, content) {
        let type, message;
        if (content.startsWith("+\u0001ACTION ")) {
            type = "me";
            message = content
                // eslint-disable-next-line no-control-regex
                .split(/^\+\u0001ACTION\s+/)[1]
                // eslint-disable-next-line no-control-regex
                .split(/\u0001$/)[0];
        } else {
            type = "message";
            message = content;
        }
        this.emitEvent(EVENT_INCOMING, {
            context: "irc",
            type: "send",
            actor: {
                type: "person",
                id: nick + "@" + this.server,
                name: nick,
            },
            target: {
                type: target.startsWith("#") ? "room" : "person",
                id: this.server + "/" + target,
                name: target,
            },
            object: {
                type: type,
                content: message,
            },
        });
    }

    role(type: string, nick: string, target: string, role: string, channel: string) {
        this.emitEvent(EVENT_INCOMING, {
            context: "irc",
            type: type,
            actor: {
                type: "person",
                id: nick + "@" + this.server,
                name: nick,
            },
            target: {
                type: "person",
                id: target + "@" + this.server,
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
                    id: this.server + "/" + channel,
                    name: channel,
                },
            },
        });
    }

    nickChange(nick: string, content) {
        this.emitEvent(EVENT_INCOMING, {
            context: "irc",
            type: "update",
            actor: {
                type: "person",
                id: nick + "@" + this.server,
                name: nick,
            },
            target: {
                type: "person",
                id: content + "@" + this.server,
                name: content,
            },
            object: {
                type: "address",
            },
        });
    }
}
