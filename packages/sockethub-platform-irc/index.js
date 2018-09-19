/**
 * This is a platform for sockethub implementing IRC functionality.
 *
 * Developed by Nick Jennings (https://github.com/silverbucket)
 *
 * Sockethub is licensed under the LGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of this module can be found here:
 *   git://github.com/sockethub/sockethub-platform-irc.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

if (typeof (NetSocket) !== 'object') {
  NetSocket = require('net').Socket;
}
if (typeof (TlsSocket) !== 'object') {
  TlsSocket = require('tls').TLSSocket;
}
if (typeof (IrcSocket) !== 'object') {
  IrcSocket = require('irc-socket');
}
if (typeof (IRC2AS) !== 'object') {
  IRC2AS = require('irc2as');
}

const debug = require('debug')('sockethub-platform-irc'),
      packageJSON = require('./package.json');


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
  this.updateCredentials = cfg.updateCredentials;
  this.__forceDisconnect = false;
  this.__client = undefined;
  this.__jobQueue = []; // list of handlers to confirm when message delivery confirmed
  this.__channels = new Set();
  this.__handledActors = new Set();
}

/**
 * Property: schema
 *
 * @description
 * JSON schema defining the @types this platform accepts.
 *
 *
 * In the below example, sockethub will validate the incoming credentials object
 * against whatever is defined in the `credentials` portion of the schema
 * object.
 *
 *
 * It will also check if the incoming AS object uses a @type which exists in the
 * `@types` portion of the schema object (should be an array of @type names).
 *
 * * **NOTE**: For more information on using the credentials object from a client, see [Sockethub Client](https://github.com/sockethub/sockethub/wiki/Sockethub-Client)
 *
 * Valid AS object for setting IRC credentials:
 * @example
 *
 *  {
 *    '@type': 'set',
 *    context: 'irc',
 *    actor: {
 *      '@id': 'irc://testuser@irc.host.net',
 *      '@type': 'person',
 *      displayName: 'Mr. Test User',
 *      userName: 'testuser'
 *    },
 *    object: {
 *      '@type': 'credentials',
 *      server: 'irc.host.net',
 *      nick: 'testuser',
 *      password: 'asdasdasdasd',
 *      port: 6697,
 *      secure: true
 *    }
 *  }
 *
 *
 */
IRC.prototype.schema = {
  "version": packageJSON.version,
  "messages" : {
    "required": [ '@type' ],
    "properties": {
      "@type": {
        "enum": [ 'update', 'join', 'leave', 'send', 'observe', 'announce' ]
      }
    }
  },
  "credentials" : {
    "required": [ 'object' ],
    "properties": {
      // TODO platforms shouldn't have to define the actor property if they don't want to, just credential specifics
      "actor": {
        "type": "object",
        "required": [ "@id" ]
      },
      "object": {
        "name": "object",
        "type": "object",
        "required": [ '@type', 'nick', 'server' ],
        "additionalProperties": false,
        "properties" : {
          "@type": {
            "name": "@type",
            "type": "string"
          },
          "nick" : {
            "name" : "nick",
            "type": "string"
          },
          "password" : {
            "name" : "password",
            "type": "string"
          },
          "server" : {
            "name" : "server",
            "type": "string"
          },
          "port" : {
            "name": "port",
            "type": "number"
          },
          "secure": {
            "name": "secure",
            "type": "boolean"
          }
        }
      }
    }
  }
};


IRC.prototype.config = {
  persist: true
};


/**
 * Function: join
 *
 * Join a room or private conversation.
 *
 * @param {object} job activiy streams object // TODO LINK
 * @param {object} credentials credentials object // TODO LINK
 * @param {object} done callback when job is done // TODO LINK
 *
 * @example
 *
 * {
 *   context: 'irc',
 *   '@type': 'join',
 *   actor: {
 *     '@id': 'irc://slvrbckt@irc.freenode.net',
 *     '@type': 'person',
 *     displayName: 'slvrbckt'
 *   },
 *   target: {
 *     '@id': 'irc://irc.freenode.net/sockethub',
 *     '@type': 'room',
 *     displayName: '#sockethub'
 *   },
 *   object: {}
 * }
 *
 */
IRC.prototype.join = function (job, credentials, done) {
  this.debug('join() called for ' + job.actor['@id']);
  if (this.__channels.has(job.target.displayName)) {
    this.debug(`channel ${job.target.displayName} already joined`)
    return done();
  }
  this.__getClient(job.actor['@id'], credentials, (err, client) => {
    if (err) { return done(err); }
    // join channel
    this.__jobQueue.push(() => {
      this.__hasJoined(job.target.displayName);
      done();
    });
    this.debug('sending join ' + job.target.displayName);
    client.raw(['JOIN', job.target.displayName]);
  });
};

/**
 * Function leave
 *
 * Leave a room or private conversation.
 *
 * @param {object} job activiy streams object // TODO LINK
 * @param {object} credentials credentials object // TODO LINK
 * @param {object} done callback when job is done // TODO LINK
 *
 * @example
 * {
 *   context: 'irc',
 *   '@type': 'leave',
 *   actor: {
 *     '@id': 'irc://slvrbckt@irc.freenode.net',
 *     '@type': 'person',
 *     displayName: 'slvrbckt'
 *   },
 *   target: {
 *     '@id': 'irc://irc.freenode.net/remotestorage',
 *     '@type': 'room',
 *     displayName: '#remotestorage'
 *   },
 *   object: {}
 * }
 *
 */
IRC.prototype.leave = function (job, credentials, done) {
  this.debug('leave() called for ' + job.actor.displayName);
  this.__getClient(job.actor['@id'], credentials, (err, client) => {
    if (err) { return done(err); }
    // leave channel
    this.__hasLeft(job.target.displayName);
    client.raw(['PART', job.target.displayName]);
    done();
  });
};

/**
 * Function: send
 *
 * Send a message to a room or private conversation.
 *
 * @param {object} job activiy streams object // TODO LINK
 * @param {object} credentials credentials object // TODO LINK
 * @param {object} done callback when job is done // TODO LINK
 *
 * @example
 *
 *  {
 *    context: 'irc',
 *    '@type': 'send',
 *    actor: {
 *      '@id': 'irc://slvrbckt@irc.freenode.net',
 *      '@type': 'person',
 *      displayName: 'Nick Jennings',
 *      userName: 'slvrbckt'
 *    },
 *    target: {
 *      '@id': 'irc://irc.freenode.net/remotestorage',
 *      '@type': 'room',
 *      displayName: '#remotestorage'
 *    },
 *    object: {
 *      '@type': 'message',
 *      content: 'Hello from Sockethub!'
 *    }
 *  }
 *
 */
IRC.prototype.send = function (job, credentials, done) {
  this.debug('send() called for ' + job.actor['@id'] + ' target: ' + job.target['@id']);
  this.__getClient(job.actor['@id'], credentials, (err, client) => {
    if (err) { return done(err); }

    if (typeof job.object.content !== 'string') {
      return done('cannot send message with no object.content');
    }

    let msg = job.object.content.replace(/^\s+|\s+$/g, "");
    if (msg.indexOf('/') === 0) {
      // message intented as command
      msg += ' ';
      const cmd = msg.substr(0, msg.indexOf(' ')).substr(1).toUpperCase(); // get command
      msg = msg.substr(msg.indexOf(' ') + 1).replace(/\s\s*$/, ''); // remove command from message
      if (cmd === 'ME') {
        // handle /me messages uniquely
        job.object['@type'] = 'me';
        job.object.content = msg;
      } else if (cmd === 'NOTICE') {
        // attempt to send as raw command
        job.object['@type'] = 'notice';
        job.object.content = msg;
      }
    } else {
      job.object.content = msg;
    }

    if (job.object['@type'] === 'me') {
      // message intented as command
      const message = '\001ACTION ' + job.object.content + '\001';
      client.raw('PRIVMSG ' + job.target.displayName + ' :' + message);
    } else if (job.object['@type'] === 'notice') {
      // attempt to send as raw command
      client.raw('NOTICE ' + job.target.displayName + ' :' + job.object.content);
    } else if (this.__isJoined(job.target.displayName)) {
      client.raw('PRIVMSG ' + job.target.displayName + ' :' + job.object.content);
    } else {
      return done("cannot send message to a channel of which you've not first joined.")
    }
    this.__jobQueue.push(done);
    client.raw('PING ' + job.actor.displayName);
  });
};

/**
 * Function: update
 *
 * Indicate a change (ie. room topic update, or nickname change).
 *
 * @param {object} job activiy streams object // TODO LINK
 * @param {object} credentials redentials object // TODO LINK
 * @param {object} done callback when job is done // TODO LINK
 *
 * @example change topic
 *
 * {
 *   context: 'irc',
 *   '@type': 'update',
 *   actor: {
 *     '@id': 'irc://slvrbckt@irc.freenode.net',
 *     '@type': 'person',
 *     displayName: 'Nick Jennings',
 *     userName: 'slvrbckt'
 *   },
 *   target: {
 *     '@id': 'irc://irc.freenode.net/sockethub',
 *     '@type': 'room',
 *     displayName: '#sockethub'
 *   },
 *   object: {
 *     '@type': 'topic',
 *     topic: 'New version of Socekthub released!'
 *   }
 * }
 *
 * @example change nickname
 *  {
 *    context: 'irc'
 *    '@type': 'udpate',
 *    actor: {
 *      '@id': 'irc://slvrbckt@irc.freenode.net',
 *      '@type': 'person',
 *      displayName: 'slvrbckt'
 *    },
 *    object: {
 *      '@type': "address",
 *    },
 *    target: {
 *      '@id': 'irc://cooldude@irc.freenode.net',
 *      '@type': 'person',
 *      displayName: cooldude
 *    }
 *  }
 */
IRC.prototype.update = function (job, credentials, done) {
  this.debug('update() called for ' + job.actor.displayName);
  this.__getClient(job.actor['@id'], credentials, (err, client) => {
    if (err) { return done(err); }

    if (job.object['@type'] === 'address')  {
      this.debug('changing nick from ' + job.actor.displayName + ' to ' + job.target.displayName);
      this.__jobQueue.push(() => {
        this.debug('completing nick change');
        credentials.object.nick = job.target.displayName;
        this.updateCredentials(job.target.displayName, credentials.object.server, credentials.object, done);
      });
      // send nick change command
      client.raw(['NICK', job.target.displayName]);
    } else if (job.object['@type'] === 'topic') {
      // update topic
      this.debug('changing topic in channel ' + job.target.displayName);
      this.__jobQueue.push(done);
      client.raw(['topic', job.target.displayName, job.object.topic]);
    } else {
      return done(`unknown update action.`);
    }
  });
};

/**
 * Function: observe
 *
 * Indicate an intent to observe something (ie. get a list of users in a room).
 *
 * @param {object} job activiy streams object // TODO LINK
 * @param {object} credentials credentials object // TODO LINK
 * @param {object} done callback when job is done // TODO LINK
 *
 * @example
 *
 *  {
 *    context: 'irc',
 *    '@type': 'observe',
 *    actor: {
 *      '@id': 'irc://slvrbckt@irc.freenode.net',
 *      '@type': 'person',
 *      displayName: 'Nick Jennings',
 *      userName: 'slvrbckt'
 *    },
 *    target: {
 *      '@id': 'irc://irc.freenode.net/sockethub',
 *      '@type': 'room',
 *      displayName: '#sockethub'
 *    },
 *    object: {
 *      '@type': 'attendance'
 *    }
 *  }
 *
 *
 *  // The obove object might return:
 *  {
 *    context: 'irc',
 *    '@type': 'observe',
 *    actor: {
 *      '@id': 'irc://irc.freenode.net/sockethub',
 *      '@type': 'room',
 *      displayName: '#sockethub'
 *    },
 *    target: {},
 *    object: {
 *      '@type': 'attendance'
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
IRC.prototype.observe = function (job, credentials, done) {
  this.debug('observe() called for ' + job.actor['@id']);
  this.__getClient(job.actor['@id'], credentials, (err, client) => {
    if (err) { return done(err); }

    if (job.object['@type'] === 'attendance') {
      this.debug('observe() - sending NAMES for ' + job.target.displayName);
      client.raw(['NAMES', job.target.displayName]);
      done();
    } else {
      done("unknown '@type' '" + job.object['@type'] + "'");
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
  if (this.__client) {
    return cb(null, this.__client);
  }

  if (! credentials) {
    return cb('no client found, and no credentials specified.');
  }

  this.__connect(key, credentials, (err, client) => {
    if (err) {
      return cb(err);
    }
    this.__handledActors.add(credentials.actor['@id']);
    this.__client = client;
    this.__registerListeners(credentials.object.server);
    return cb(null, client);
  });
};


IRC.prototype.__connect = function (key, credentials, cb) {
  const netSocket = new NetSocket();
  const is_secure = false; // (typeof credentials.object.secure === 'boolean') ? credentials.object.secure : true;
  let socket = netSocket;
  if (is_secure) {
    socket = new TlsSocket(netSocket, { rejectUnauthorized: false });
  }

  const module_creds = {
    socket: socket,
    username: credentials.object.nick,
    nicknames: [ credentials.object.nick ],
    server: credentials.object.server || 'irc.freenode.net',
    realname: credentials.actor.displayName || credentials.object.nick,
    port: (is_secure) ? 6697 : 6667,
    // port: (credentials.object.port) ? parseInt(credentials.object.port, 10) : (is_secure) ? 6697 : 6667,
    debug: console.log
  };

  this.debug('attempting to connect to ' + module_creds.server + ':' + module_creds.port);
  const client = IrcSocket(module_creds);

  function __forceDisconnect(err) {
    this.__forceDisconnect = true;
    if ((client) && (typeof client.end === 'function')) {
      client.end();
    }
    if ((this.__client) && (typeof this.__client.end === 'function')) {
      this.__client.end();
    }
    throw new Error(err);
  }

  client.once('error', (err) => {
    this.debug('irc client \'error\' occurred.' + err);
    __forceDisconnect.apply(this, ['error with connection to server.']);
  });

  client.once('close', () => {
    this.debug('irc client \'close\' event fired.');
    __forceDisconnect.apply(this, ['connection to server closed.']);
  });

  client.once('timeout', () => {
    this.debug('timeout occurred, force-disconnect');
    __forceDisconnect.apply(this, ['connection timeout to server.']);
    return cb('timeout during connect');
  });

  client.connect().then((res) => {
    if (res.isOk()) {
      if (this.__forceDisconnect) {
        client.end();
        return cb('force disconnect active, aborting connect.');
      }
      this.debug('connected to ' + module_creds.server);
      return cb(null, client);
    } else {
      return cb('unable to connect to server');
    }
  });
};


IRC.prototype.__completeJob = function (err) {
  this.debug(`completing job. queue count: ${this.__jobQueue.length}`);
  const done = this.__jobQueue.shift();
  if (typeof done === 'function') {
    done(err);
  } else {
    this.debug('WARNING: job completion event received with an empty job queue.');
  }
};


IRC.prototype.__registerListeners = function (server) {
  this.debug('adding listener for \'data\'');
  this.irc2as = new IRC2AS({ server: server });
  this.__client.on('data', (data) => {
    this.irc2as.input(data);
  });

  this.irc2as.events.on('incoming', (asObject) => {
    this.debug('incoming irc object, handled actors: ', [...this.__handledActors.values()]);
    if ((typeof asObject.actor === 'object') &&
        (typeof asObject.actor.displayName === 'string') &&
        (this.__handledActors.has(asObject.actor['@id']))) {
      this.__completeJob();
    } else {
      this.debug('calling sendToClient for ' + asObject.actor['@id'], [...this.__handledActors.keys()]);
      this.sendToClient(asObject);
    }
  });

  this.irc2as.events.on('unprocessed', (string) => {
    this.debug('unprocessed irc message:> ' + string);
  });

  this.irc2as.events.on('error', (asObject) => {
    this.debug('message error response ' + asObject.object.content);
    this.__completeJob(asObject.object.content);
  });

  this.irc2as.events.on('pong', (timestamp) => {
    this.debug('received PONG at ' + timestamp);
    this.__completeJob();
  });

  this.irc2as.events.on('ping', (timestamp) => {
    this.debug('sending PING at ' + timestamp);
  });
};

module.exports = IRC;