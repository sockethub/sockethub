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

if (typeof (NetSocket) !== 'object') {
  net = require('net');
}
if (typeof (TlsSocket) !== 'object') {
  tls = require('tls');
}
if (typeof (IrcSocket) !== 'object') {
  IrcSocket = require('irc-socket-sasl');
}
if (typeof (IRC2AS) !== 'object') {
  IRC2AS = require('irc2as');
}

const packageJSON = require('./package.json');


/**
 * @class IRC
 * @constructor
 *
 * @description
 * Handles all actions related to communication via. the IRC protocol.
 *
 * Uses the `irc-factory` node module as a base tool for interacting with IRC.
 *
 * {@link https://github.com/ircanywhere/irc-factory}
 *
 * @param {object} cfg a unique config object for this instance // TODO LINK
 */
function IRC(cfg) {
  cfg = (typeof cfg === 'object') ? cfg : {};
  this.debug = cfg.debug;
  this.sendToClient = cfg.sendToClient;
  this.updateActor = cfg.updateActor;
  this.__forceDisconnect = false;
  this.__clientConnecting = false;
  this.__client = undefined;
  this.__jobQueue = []; // list of handlers to confirm when message delivery confirmed
  this.__channels = new Set();
  this.__handledActors = new Set();
}

/**
 * Property: schema
 *
 * @description
 * JSON schema defining the types this platform accepts.
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
 * * **NOTE**: For more information on using the credentials object from a client,
 * see [Sockethub Client](https://github.com/sockethub/sockethub/wiki/Sockethub-Client)
 *
 * Valid AS object for setting IRC credentials:
 * @example
 *
 *  {
 *    type: 'credentials',
 *    context: 'irc',
 *    actor: {
 *      id: 'testuser@irc.host.net',
 *      type: 'person',
 *      name: 'Mr. Test User',
 *      userName: 'testuser'
 *    },
 *    object: {
 *      type: 'credentials',
 *      server: 'irc.host.net',
 *      nick: 'testuser',
 *      password: 'asdasdasdasd',
 *      port: 6697,
 *      secure: true,
 *      sasl: true
 *    }
 *  }
 */
IRC.prototype.schema = {
  "version": packageJSON.version,
  "messages" : {
    "required": [ 'type' ],
    "properties": {
      "type": {
        "enum": [ 'connect', 'update', 'join', 'leave', 'send', 'query', 'announce' ]
      }
    }
  },
  "credentials" : {
    "required": [ 'object' ],
    "properties": {
      // TODO platforms shouldn't have to define the actor property
      //  if they don't want to, just credential specifics
      "actor": {
        "type": "object",
        "required": [ "id" ]
      },
      "object": {
        "type": "object",
        "required": [ 'type', 'nick', 'server' ],
        "additionalProperties": false,
        "properties" : {
          "type": {
            "type": "string"
          },
          "nick" : {
            "type": "string"
          },
          "username" : {
            "type": "string"
          },
          "password" : {
            "type": "string"
          },
          "server" : {
            "type": "string"
          },
          "port" : {
            "type": "number"
          },
          "secure": {
            "type": "boolean"
          },
          "sasl": {
            "type": "boolean"
          }
        }
      }
    }
  }
};


IRC.prototype.config = {
  persist: true,
  requireCredentials: [ 'connect', 'update' ],
  initialized: false
};

/**
 * Function: connect
 *
 * Conenct to an IRC server.
 *
 * @param {object} job activity streams object
 * @param {object} credentials credentials object
 * @param {object} done callback when job is done
 */

IRC.prototype.connect = function (job, credentials, done) {
  this.__getClient(job.actor.id, credentials, (err, client) => {
    if (err) { return done(err); }
    return done();
  });
};

/**
 * Function: join
 *
 * Join a room or private conversation.
 *
 * @param {object} job activity streams object // TODO LINK
 * @param {object} done callback when job is done // TODO LINK
 *
 * @example
 *
 * {
 *   context: 'irc',
 *   type: 'join',
 *   actor: {
 *     id: 'slvrbckt@irc.freenode.net',
 *     type: 'person',
 *     name: 'slvrbckt'
 *   },
 *   target: {
 *     id: 'irc.freenode.net/a-room',
 *     type: 'room',
 *     name: '#a-room'
 *   },
 *   object: {}
 * }
 *
 */
IRC.prototype.join = function (job, done) {
  this.debug('join() called for ' + job.actor.id);
  this.__getClient(job.actor.id, false, (err, client) => {
    if (err) { return done(err); }
    if (this.__channels.has(job.target.name)) {
      this.debug(`channel ${job.target.name} already joined`);
      return done();
    }
    // join channel
    this.__jobQueue.push(() => {
      this.__hasJoined(job.target.name);
      done();
    });
    this.debug('sending join ' + job.target.name);
    client.raw(['JOIN', job.target.name]);
    client.raw('PING ' + job.actor.name);
  });
};

/**
 * Function leave
 *
 * Leave a room or private conversation.
 *
 * @param {object} job activity streams object // TODO LINK
 * @param {object} done callback when job is done // TODO LINK
 *
 * @example
 * {
 *   context: 'irc',
 *   type: 'leave',
 *   actor: {
 *     id: 'slvrbckt@irc.freenode.net',
 *     type: 'person',
 *     name: 'slvrbckt'
 *   },
 *   target: {
 *     id: 'irc.freenode.net/remotestorage',
 *     type: 'room',
 *     name: '#remotestorage'
 *   },
 *   object: {}
 * }
 *
 */
IRC.prototype.leave = function (job, done) {
  this.debug('leave() called for ' + job.actor.name);
  this.__getClient(job.actor.id, false, (err, client) => {
    if (err) { return done(err); }
    // leave channel
    this.__hasLeft(job.target.name);
    client.raw(['PART', job.target.name]);
    done();
  });
};

/**
 * Function: send
 *
 * Send a message to a room or private conversation.
 *
 * @param {object} job activity streams object // TODO LINK
 * @param {object} done callback when job is done // TODO LINK
 *
 * @example
 *
 *  {
 *    context: 'irc',
 *    type: 'send',
 *    actor: {
 *      id: 'slvrbckt@irc.freenode.net',
 *      type: 'person',
 *      name: 'Nick Jennings',
 *      userName: 'slvrbckt'
 *    },
 *    target: {
 *      id: 'irc.freenode.net/remotestorage',
 *      type: 'room',
 *      name: '#remotestorage'
 *    },
 *    object: {
 *      type: 'message',
 *      content: 'Hello from Sockethub!'
 *    }
 *  }
 *
 */
IRC.prototype.send = function (job, done) {
  this.debug('send() called for ' + job.actor.id + ' target: ' + job.target.id);
  this.__getClient(job.actor.id, false, (err, client) => {
    if (err) { return done(err); }

    if (typeof job.object.content !== 'string') {
      return done('cannot send message with no object.content');
    }

    let msg = job.object.content.trim();
    if (msg.indexOf('/') === 0) {
      // message intented as command
      msg += ' ';
      const cmd = msg.substr(0, msg.indexOf(' ')).substr(1).toUpperCase(); // get command
      msg = msg.substr(msg.indexOf(' ') + 1).replace(/\s\s*$/, ''); // remove command from message
      if (cmd === 'ME') {
        // handle /me messages uniquely
        job.object.type = 'me';
        job.object.content = msg;
      } else if (cmd === 'NOTICE') {
        // attempt to send as raw command
        job.object.type = 'notice';
        job.object.content = msg;
      }
    } else {
      job.object.content = msg;
    }

    if (job.object.type === 'me') {
      // message intended as command
      // jsdoc does not like this octal escape sequence but it's needed for proper behavior in IRC
      // so the following line needs to be commented out when the API doc is built.
      // investigate:
      // https://github.com/jsdoc2md/jsdoc-to-markdown/issues/197#issuecomment-976851915
      const message = '\001ACTION ' + job.object.content + '\001';
      client.raw('PRIVMSG ' + job.target.name + ' :' + message);
    } else if (job.object.type === 'notice') {
      // attempt to send as raw command
      client.raw('NOTICE ' + job.target.name + ' :' + job.object.content);
    } else if (this.__isJoined(job.target.name)) {
      client.raw('PRIVMSG ' + job.target.name + ' :' + job.object.content);
    } else {
      return done("cannot send message to a channel of which you've not first joined.");
    }
    this.__jobQueue.push(done);
    client.raw('PING ' + job.actor.name);
  });
};

/**
 * Function: update
 *
 * Indicate a change (ie. room topic update, or nickname change).
 *
 * @param {object} job activity streams object // TODO LINK
 * @param {object} done callback when job is done // TODO LINK
 *
 * @example change topic
 *
 * {
 *   context: 'irc',
 *   type: 'update',
 *   actor: {
 *     id: 'slvrbckt@irc.freenode.net',
 *     type: 'person',
 *     name: 'Nick Jennings',
 *     userName: 'slvrbckt'
 *   },
 *   target: {
 *     id: 'irc.freenode.net/a-room',
 *     type: 'room',
 *     name: '#a-room'
 *   },
 *   object: {
 *     type: 'topic',
 *     content: 'New version of Socekthub released!'
 *   }
 * }
 *
 * @example change nickname
 *  {
 *    context: 'irc'
 *    type: 'udpate',
 *    actor: {
 *      id: 'slvrbckt@irc.freenode.net',
 *      type: 'person',
 *      name: 'slvrbckt'
 *    },
 *    object: {
 *      type: "address",
 *    },
 *    target: {
 *      id: 'cooldude@irc.freenode.net',
 *      type: 'person',
 *      name: cooldude
 *    }
 *  }
 */
IRC.prototype.update = function (job, credentials, done) {
  this.debug('update() called for ' + job.actor.id);
  this.__getClient(job.actor.id, false, (err, client) => {
    if (err) { return done(err); }
    if (job.object.type === 'address')  {
      this.debug('changing nick from ' + job.actor.name + ' to ' + job.target.name);
      this.__handledActors.add(job.target.id);
      this.__jobQueue.push((err) => {
        if (err) {
          this.__handledActors.delete(job.target.id);
          return done(err);
        }
        credentials.object.nick = job.target.name;
        credentials.actor.id = `${job.target.name}@${credentials.object.server}`;
        credentials.actor.name = job.target.name;
        this.updateActor(credentials);
        done();
      });
      // send nick change command
      client.raw(['NICK', job.target.name]);
    } else if (job.object.type === 'topic') {
      // update topic
      this.debug('changing topic in channel ' + job.target.name);
      this.__jobQueue.push(done);
      client.raw(['topic', job.target.name, job.object.content]);
    } else {
      return done(`unknown update action.`);
    }
    client.raw('PING ' + job.actor.name);
  });
};

/**
 * Function: query
 *
 * Indicate an intent to query something (e.g. get a list of users in a room).
 *
 * @param {object} job activity streams object // TODO LINK
 * @param {object} done callback when job is done // TODO LINK
 *
 * @example
 *
 *  {
 *    context: 'irc',
 *    type: 'query',
 *    actor: {
 *      id: 'slvrbckt@irc.freenode.net',
 *      type: 'person',
 *      name: 'Nick Jennings',
 *      userName: 'slvrbckt'
 *    },
 *    target: {
 *      id: 'irc.freenode.net/a-room',
 *      type: 'room',
 *      name: '#a-room'
 *    },
 *    object: {
 *      type: 'attendance'
 *    }
 *  }
 *
 *
 *  // The above object might return:
 *  {
 *    context: 'irc',
 *    type: 'query',
 *    actor: {
 *      id: 'irc.freenode.net/a-room',
 *      type: 'room',
 *      name: '#a-room'
 *    },
 *    target: {},
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
 *
 */
IRC.prototype.query = function (job, done) {
  this.debug('query() called for ' + job.actor.id);
  this.__getClient(job.actor.id, false, (err, client) => {
    if (err) { return done(err); }

    if (job.object.type === 'attendance') {
      this.debug('query() - sending NAMES for ' + job.target.name);
      client.raw(['NAMES', job.target.name]);
      done();
    } else {
      done("unknown 'type' '" + job.object.type + "'");
    }
  });
};


IRC.prototype.cleanup = function (done) {
  this.debug('cleanup() called');
  this.__forceDisconnect = true;
  if (typeof this.__client === 'object') {
    if (typeof this.__client.end === 'function') {
      this.__client.end();
    }
  }
  this.initialized = false;
  delete this.__client;
  return done();
};



//
// Private methods
//


IRC.prototype.__isJoined = function (channel) {
  if (channel.indexOf('#') === 0) {
    // valid channel name
    return this.__channels.has(channel);
  } else {
    // usernames are always OK to send to
    return true;
  }
};


IRC.prototype.__hasJoined = function (channel) {
  this.debug('joined ' + channel);
  // keep track of channels joined
  if (! this.__channels.has(channel)) {
    this.__channels.add(channel);
  }
};


IRC.prototype.__hasLeft = function (channel) {
  this.debug('left ' + channel);
  // keep track of channels left
  if (this.__channels.has(channel)) {
    this.__channels.delete(channel);
  }
};


IRC.prototype.__getClient = function (key, credentials, cb) {
  this.debug('getClient called, connecting: ' + this.__clientConnecting);
  if (this.__client) {
    this.__handledActors.add(key);
    return cb(null, this.__client);
  } else if (this.__clientConnecting) {
    // client is in the process of connecting, wait
    setTimeout(function (_cb) {
      if (this.__client) {
        this.debug(`resolving delayed getClient call for ${key}`);
        this.__handledActors.add(key);
        return _cb(null, this.__client);
      } else {
        return cb('failed to get irc client, please try again.');
      }
    }.bind(this, cb), 30000);
    return;
  }

  if (! credentials) {
    return cb('no client found, and no credentials specified. you must connect first');
  } else {
    this.__connect(key, credentials, (err, client) => {
      if (err) {
        this.initialized = false;
        return cb(err);
      }
      this.__handledActors.add(key);
      this.__client = client;
      this.__registerListeners(credentials.object.server);
      this.initialized = true;
      return cb(null, client);
    });
  }
};


IRC.prototype.__connect = function (key, credentials, cb) {
  this.__clientConnecting = true;
  const is_secure = (typeof credentials.object.secure === 'boolean') ?
    credentials.object.secure : true;

  const module_options = {
    username: credentials.object.username || credentials.object.nick,
    nicknames: [ credentials.object.nick ],
    server: credentials.object.server || 'irc.libera.chat',
    realname: credentials.actor.name || credentials.object.nick,
    port: (credentials.object.port) ?
      parseInt(credentials.object.port, 10) : (is_secure) ? 6697 : 6667,
    debug: console.log
  };
  if (is_secure) {
    module_options.connectOptions = { rejectUnauthorized: false };
  }
  if (credentials.object.sasl) {
    module_options.saslPassword = credentials.object.password;
    module_options.capabilities = { requires: [ "sasl" ] };
  }

  this.debug('attempting to connect to ' + module_options.server + ':' + module_options.port +
    ` transport: ${is_secure?'secure':'clear'} sasl: ${credentials.object.sasl}`);

  const client = new IrcSocket(module_options, is_secure ? tls : net);

  const __forceDisconnect = (err) => {
    this.__forceDisconnect = true;
    this.__clientConnecting = false;
    if ((client) && (typeof client.end === 'function')) {
      client.end();
    }
    if ((this.__client) && (typeof this.__client.end === 'function')) {
      this.__client.end();
    }
    cb(err);
  };

  client.once('error', (err) => {
    this.debug(`irc client 'error' occurred. `, err);
    __forceDisconnect('error connecting to server.');
  });

  client.once('close', () => {
    this.debug(`irc client 'close' event fired.`);
    __forceDisconnect('connection to server closed.');
  });

  client.once('timeout', () => {
    this.debug('timeout occurred, force-disconnect');
    __forceDisconnect('connection timeout to server.');
  });

  client.connect().then((res) => {
    if (res.isFail()) {
      return cb(`unable to connect to server: ${res.fail()}`);
    }
    const capabilities = res.ok();
    this.__clientConnecting = false;
    if (this.__forceDisconnect) {
      client.end();
      return cb('force disconnect active, aborting connect.');
    } else {
      this.debug(`connected to ${module_options.server} capabilities: `, capabilities);
      return cb(null, client);
    }
  });
};


IRC.prototype.__completeJob = function (err) {
  this.debug(`completing job, queue count: ${this.__jobQueue.length}`);
  const done = this.__jobQueue.shift();
  if (typeof done === 'function') {
    done(err);
  } else {
    this.debug('WARNING: job completion event received with an empty job queue.');
  }
};


IRC.prototype.__registerListeners = function (server) {
  this.irc2as = new IRC2AS({ server: server });
  this.__client.on('data', (data) => {
    this.irc2as.input(data);
  });

  this.irc2as.events.on('incoming', (asObject) => {
    if ((typeof asObject.actor === 'object') &&
        (typeof asObject.actor.name === 'string') &&
        (this.__handledActors.has(asObject.actor.id))) {
      this.__completeJob();
    } else {
      this.debug(
        'calling sendToClient for ' + asObject.actor.id, [...this.__handledActors.keys()]);
      this.sendToClient(asObject);
    }
  });

  this.irc2as.events.on('unprocessed', (string) => {
    this.debug('unprocessed irc message:> ' + string);
  });

  // The generated eslint error expects that the `error` event is propagating an Error object
  // however for irc2as this event delivers an AS object of type `error`.
  // eslint-disable-next-line security-node/detect-unhandled-event-errors
  this.irc2as.events.on('error', (asObject) => {
    this.debug('message error response ' + asObject.object.content);
    this.__completeJob(asObject.object.content);
  });

  this.irc2as.events.on('pong', (timestamp) => {
    this.debug('received PONG at ' + timestamp);
    this.__completeJob();
  });

  this.irc2as.events.on('ping', (timestamp) => {
    this.debug('received PING at ' + timestamp);
    this.__client.raw('PONG');
  });
};

module.exports = IRC;
