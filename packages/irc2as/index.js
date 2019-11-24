const events = require('events');
const debug = require('debug')('irc2as');

const EVENT_INCOMING = 'incoming',
      EVENT_ERROR = 'error',
      EVENT_PONG = 'pong',
      EVENT_PING = 'ping',
      EVENT_UNPROCESSED = 'unprocessed';

const ERR_BAD_NICK = "432",
      ERR_CHAN_PRIVS = "482",
      ERR_NICK_IN_USE = "433",
      ERR_TEMP_UNAVAIL = "437",
      ERR_NO_CHANNEL = "403",
      ERR_NOT_INVITED = "471",
      ERR_BADMODE= "472",
      ERR_INVITE_ONLY = "473",
      ERR_BANNED = "474",
      ERR_BADKEY = "475",
      ERR_BADMASK = "476",
      ERR_NOCHANMODES = "477",
      ERR_BANLISTFULL = "478",
      JOIN = "JOIN",
      MODE = "MODE",
      MOTD = "372",
      MOTD_END = "376",
      NAMES = "353",
      NAMES_END = "366",
      NICK = "NICK",
      NOTICE = "NOTICE",
      PART = "PART",
      PING = "PING",
      PONG = "PONG",
      PRIVMSG = "PRIVMSG",
      QUIT = "QUIT",
      TOPIC_CHANGE = "TOPIC",
      TOPIC_IS = "332",
      TOPIC_SET_BY = "333",
      WHO = "352",
      WHO_OLD = "354",
      WHO_END = "315";

const ROLE = {
    '@': 'owner',
    '%': 'admin',
    '*': 'participant'
};

const MODES = {
    'o': 'owner',
    'h': 'admin',
    'v': 'participant'
};


function getNickFromServerString(server) {
    return server.split(/^:/)[1].split('!')[0];
}

function IrcToActivityStreams(cfg) {
    const config = cfg || {};
    this.server = config.server;
    this.events = new events.EventEmitter();
    this.__buffer = {};
    this.__buffer[NAMES] = {};
    return this;
}

IrcToActivityStreams.prototype._sendPresence = function (username, role, channel, time) {
    this.events.emit(EVENT_INCOMING, {
        '@type': 'update',
        actor: {
            '@type': 'person',
            '@id': `${username}@${this.server}`,
            'displayName': username,
        },
        target: {
            '@type': 'room',
            '@id': this.server + '/' + channel,
            displayName: channel
        },
        object: {
            '@type': 'presence',
            role: role
        },
        published: time
    });
};

IrcToActivityStreams.prototype.input = function (string) {
    debug(string);
    if (typeof string !== 'string') {
        debug('unable to process incoming message as it was not a string.');
        return false;
    }
    if (string.length < 3) {
        debug('unable to process incoming string, length smaller than 3.');
        return false;
    }
    string = string.trim();
    const time = '' + Date.now();
    const [metadata, content] = string.split(' :');
    const [server, code, pos1, pos2, pos3, ...msg] = metadata.split(" ");
    const channel = ((typeof pos1 === "string") && (pos1.startsWith('#'))) ? pos1 :
                    ((typeof pos2 === "string") && (pos2.startsWith('#'))) ? pos2 :
                    ((typeof pos3 === "string") && (pos3.startsWith('#'))) ? pos3 : undefined;
    let nick, type, message, role;

    if (metadata === PING) {
        this.events.emit(EVENT_PING, time);
        return true;
    }

    debug(`[${code}] server: ${server} channel: ${channel} 1: ${pos1}, 2: ${pos2}, 3: ${pos3}.` +
          ` content: `, content);
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
        this.events.emit(EVENT_ERROR, {
            '@type': 'send',
            actor: {
              '@type': 'room',
              '@id': this.server + '/' + channel
            },
            target: {
              '@type': 'person',
              '@id': pos1 + '@' + this.server
            },
            object: {
              '@type': 'error',
              content: content
            },
            published: time
        });
        break;

        /** */
        case ERR_NICK_IN_USE: // nick conflict
        case ERR_BAD_NICK:
        this.events.emit(EVENT_ERROR, {
            '@type': 'update',
            actor: {
                '@type': 'service',
                '@id': this.server
            },
            object: {
                '@type': 'error',
                content: content
            },
            target: {
                '@type': 'person',
                '@id': pos2 + '@' + this.server,
                displayName: pos2
            },
            published: time
        });
        break;

        /** */
        case ERR_NO_CHANNEL: // no such channel
        this.events.emit(EVENT_ERROR, {
            '@type': 'join',
            actor: {
                '@id': this.server,
                '@type': 'service'
            },
            object: {
                '@type': 'error',
                content: 'no such channel ' + pos2
            },
            target: {
                '@id': pos2 + '@' + this.server,
                '@type': 'person'
            },
            published: time
        });
        break;

        /** */
        case ERR_TEMP_UNAVAIL: // nick conflict
        this.events.emit(EVENT_ERROR, {
            '@type': 'update',
            actor: {
                '@type': 'service',
                '@id': this.server
            },
            object: {
                '@type': 'error',
                content: content
            },
            target: {
                '@type': 'person',
                '@id': pos2 + '@' + this.server,
                displayName: pos2
            },
            published: time
        });
        break;

        /** */
        case JOIN: // room join
        nick = getNickFromServerString(server);
        this.events.emit(EVENT_INCOMING, {
            '@type': 'join',
            actor: {
                '@type': 'person',
                '@id': nick + '@' + this.server,
                displayName: nick
            },
            target: {
                '@type': 'room',
                '@id': this.server + '/' + channel,
                displayName: channel
            },
            object: {},
            published: time
        });
        break;

        case MODE: // custom event indicating a channel mode has been updated, used to re-query user or channel
        user_mode = pos2 || content;
        if (! channel) { break; } // don't handle cases with no channel defined
        if (! pos3) { break; } // we need target user
        nick = getNickFromServerString(server);
        role = MODES[user_mode[1]] || 'member';
        type = 'add';
        if (user_mode[0] === '-') {
            type = 'remove';
        }
        this.events.emit(EVENT_INCOMING, {
            '@type': type,
            actor: {
                '@type': 'person',
                '@id': nick + '@' + this.server,
                displayName: nick
            },
            target: {
                '@type': 'person',
                '@id': pos3 + '@' + this.server,
                displayName: pos3
            },
            object: {
                "@type": "relationship",
                "relationship": 'role',
                "subject": {
                    '@type': 'presence',
                    role: role
                },
                "object": {
                    '@type': 'room',
                    '@id': this.server + '/' + channel,
                    displayName: channel
                }
            },
            published: time
        });
        break;

        /** */
        case MOTD: // MOTD
        if (! this.__buffer[MOTD]) {
            this.__buffer[MOTD] = {
                '@type': 'update',
                actor: {
                    '@type': 'service',
                    '@id': this.server,
                    displayName: this.server
                },
                object: {
                    '@type': 'topic',
                    content: [ content ]
                },
                published: time
            }
        } else {
            this.__buffer[MOTD].object.content.push(content);
        }
        break;
        case MOTD_END: // end of MOTD
        if (! this.__buffer[MOTD]) { break; }
        this.events.emit(EVENT_INCOMING, this.__buffer[MOTD]);
        delete this.__buffer[MOTD];
        break;

        /** */
        case NAMES:  // user list
        for (let entry of content.split(' ')) {
            role = 'member';
            let username = entry;
            if (ROLE[entry[0]]) {
                username = entry.substr(1);
                role = ROLE[entry[0]];
            }
            this._sendPresence(username, role, channel, time);
        }
        break;

        /** */
        case NICK: // nick change
        nick = getNickFromServerString(server);
        debug(`- 2 nick: ${nick} from content: ${content}`);
        this.events.emit(EVENT_INCOMING, {
            '@type': 'update',
            actor: {
                '@type': 'person',
                '@id': nick + '@' + this.server,
                displayName: nick
            },
            target: {
                '@type': 'person',
                '@id': content + '@' + this.server,
                displayName: content
            },
            object: {
                '@type': 'address'
            },
            published: time
        });
        break;

        /** */
        case NOTICE: // notice
        this.events.emit(EVENT_INCOMING, {
            '@type': 'update',
            actor: {
                '@type': 'service',
                '@id': this.server
            },
            object: {
                '@type': 'error',
                content: content
            },
            target: {
                '@type': 'person',
                '@id': pos1 + '@' + this.server,
                displayName: pos1
            },
            published: time
        });
        break;

        /** */
        case PART: // leaving
        nick = getNickFromServerString(server);
        this.events.emit(EVENT_INCOMING, {
            '@type': 'leave',
            actor: {
                '@type': 'person',
                '@id': nick + '@' + this.server,
                displayName: nick
            },
            target: {
                '@type': 'room',
                '@id': this.server + '/' + channel,
                displayName: channel
            },
            object: {
                '@type': 'message',
                content: 'user has left the channel'
            },
            published: time
        });
        break;

        /** */
        case PONG: // ping response received
        this.events.emit(EVENT_PONG, time);
        break;

        /** */
        case PRIVMSG: // msg
        nick = getNickFromServerString(server);
        if (content.startsWith('+\u0001ACTION ')) {
            type = 'me';
            message = content.split(/^\+\u0001ACTION\s+/)[1].split(/\u0001$/)[0];
        } else {
            type = 'message';
            message = content;
        }

        this.events.emit(EVENT_INCOMING, {
            '@type': 'send',
            actor: {
              '@type': 'person',
              '@id': nick + '@' + this.server,
              displayName: nick
            },
            target: {
              displayName: pos1
            },
            object: {
              '@type': type,
              content: message
            },
            published: time
        });
        break;

        /** */
        case QUIT: // quit user
        nick = getNickFromServerString(server);
        this.events.emit(EVENT_INCOMING, {
            '@type': 'leave',
            actor: {
                '@type': 'person',
                '@id': nick + '@' + this.server,
                displayName: nick
            },
            target: {
                '@type': 'service',
                '@id': this.server
            },
            object: {
                '@type': 'message',
                content: 'user has quit'
            },
            published: time
        });
        break;

        /** */
        case TOPIC_CHANGE: // topic changed now
        nick = getNickFromServerString(server);
        this.events.emit(EVENT_INCOMING, {
            '@type': 'update',
            actor: {
                '@type': 'person',
                '@id': nick + '@' + this.server,
                displayName: nick
            },
            target: {
                '@type': 'room',
                '@id': this.server + '/' + channel,
                displayName: channel
            },
            object: {
                '@type': 'topic',
                topic: content
            },
            published: time
        });
        break;

        /** */
        case TOPIC_IS: // topic currently set to
        this.__buffer[TOPIC_IS] = {
            '@type': 'update',
            actor: undefined,
            target: {
                '@type': 'room',
                '@id': this.server + '/' + channel,
                displayName: channel
            },
            object: {
                '@type': 'topic',
                topic: content
            }
        };
        break;
        case TOPIC_SET_BY: // current topic set by
        if (! this.__buffer[TOPIC_IS]) { break; }
        nick = pos3.split('!')[0];
        this.__buffer[TOPIC_IS].actor = {
            '@type': 'person',
            '@id': nick + '@' + this.server,
            displayName: nick
        };
        this.__buffer[TOPIC_IS].published = msg[0];
        this.events.emit(EVENT_INCOMING, this.__buffer[TOPIC_IS]);
        delete this.__buffer[TOPIC_IS];
        break;

        /** */
        case WHO:
        case WHO_OLD:
        nick = (msg[3].length <= 2) ? msg[2] : msg[3];
        if (nick === 'undefined') { break; }
        role = MODES[pos2[1]] || 'member';
        this._sendPresence(nick, role, channel, time);
        break;

        /** */
        default:
        this.events.emit(EVENT_UNPROCESSED, string);
        break;
    }
};

module.exports = IrcToActivityStreams;