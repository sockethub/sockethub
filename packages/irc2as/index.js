const events = require('events');
const debug = require('debug')('irc2as');
const ASTemplates = require('./as-templates');

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

class IrcToActivityStreams {
  constructor(cfg) {
    const config = cfg || {};
    this.server = config.server;
    this.events = new events.EventEmitter();
    this.__buffer = {};
    this.__buffer[NAMES] = {};
  }

  input(string) {
    debug(string);
    if (typeof string !== 'string') {
        debug('unable to process incoming message as it was not a string.');
        return false;
    } else if (string.length < 3) {
        debug('unable to process incoming string, length smaller than 3.');
        return false;
    }
    string = string.trim();
    const [metadata, content] = string.split(' :');
    const [server, code, pos1, pos2, pos3, ...msg] = metadata.split(" ");
    const channel = ((typeof pos1 === "string") && (pos1.startsWith('#'))) ? pos1 :
                    ((typeof pos2 === "string") && (pos2.startsWith('#'))) ? pos2 :
                    ((typeof pos3 === "string") && (pos3.startsWith('#'))) ? pos3 : undefined;
    if (metadata === PING) {
        this.events.emit(EVENT_PING, `${Date.now()}`);
        return true;
    }
    debug(`[${code}] server: ${server} channel: ${channel} 1: ${pos1}, 2: ${pos2}, 3: ${pos3}.` +
          ` content: `, content);
    this.__processIRCCodes(code, server, channel, pos1, pos2, pos3, content, msg);
  }

  __processIRCCodes(code, server, channel, pos1, pos2, pos3, content, msg) {
    const ast = new ASTemplates(this.events, this.server);
    let nick, type, role;
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
        ast.channelError(channel, pos1, content)
        break;

        /** */
        case ERR_NICK_IN_USE: // nick conflict
        case ERR_BAD_NICK:
        ast.serviceError(pos2, content)
        break;

        /** */
        case ERR_NO_CHANNEL: // no such channel
        ast.joinError(pos2)
        break;

        /** */
        case ERR_TEMP_UNAVAIL: // nick conflict
        ast.nickError(pos2, content);
        break;

        /** */
        case JOIN: // room join
        ast.joinRoom(channel, getNickFromServerString(server))
        break;

        case MODE: // custom event indicating a channel mode has been updated, used to re-query user or channel
        let user_mode = pos2 || content;
        if (! channel) { break; } // don't handle cases with no channel defined
        if (! pos3) { break; } // we need target user
        role = MODES[user_mode[1]] || 'member';
        type = 'add';
        if (user_mode[0] === '-') {
            type = 'remove';
        }
        ast.role(type, getNickFromServerString(server), pos3, role, channel)
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
                published: `${Date.now()}`
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
            ast.presence(username, role, channel);
        }
        break;

        /** */
        case NICK: // nick change
        // debug(`- 2 nick: ${nick} from content: ${content}`);
        ast.nickChange(getNickFromServerString(server), content);
        break;

        /** */
        case NOTICE: // notice
        ast.notice(pos1, content);
        break;

        /** */
        case PART: // leaving
        ast.userPart(channel, getNickFromServerString(server));
        break;

        /** */
        case PONG: // ping response received
        this.events.emit(EVENT_PONG, `${Date.now()}`);
        break;

        /** */
        case PRIVMSG: // msg
        ast.privMsg(getNickFromServerString(server), pos1, content);
        break;

        /** */
        case QUIT: // quit user
        ast.userQuit(getNickFromServerString(server))
        break;

        /** */
        case TOPIC_CHANGE: // topic changed now
        ast.topicChange(channel, getNickFromServerString(server), content);
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
        ast.presence(nick, role, channel);
        break;

        /** */
        // default:
        // this.events.emit(EVENT_UNPROCESSED, string);
        // break;
    }
  }
};

module.exports = IrcToActivityStreams;