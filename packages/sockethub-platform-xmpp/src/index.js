/**
 * This is a platform for sockethub implementing XMPP functionality.
 *
 * Developed by Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the LGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of this module can be found here:
 *   git://github.com/sockethub/sockethub-platform-xmpp.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

const { client, xml } = require("@xmpp/client");

const IncomingHandlers = require('./incoming-handlers');
const PlatformSchema = require('./schema.js');
const utils = require('./utils.js');


/**
 * Handles all actions related to communication via. the XMPP protocol.
 *
 * Uses `xmpp.js` as a base tool for interacting with XMPP.
 *
 * {@link https://github.com/xmppjs/xmpp.js}
 */
class XMPP {
  /**
   * Constructor called from the sockethub Platform instance, passing in a
   * session object.
   * @param {object} session - {@link Sockethub.Platform.PlatformSession#object}
   */
  constructor(session) {
    session = (typeof session === 'object') ? session : {};
    this.id = session.id; // actor
    this.debug = session.debug;
    this.sendToClient = session.sendToClient;
    this.__forceDisconnect = false;
    this.__channels = [];
  }

  /**
   * @description
   * JSON schema defining the @types this platform accepts.
   *
   * Actual handling of incoming 'set' commands are handled by dispatcher,
   * but the dispatcher uses this defined schema to validate credentials
   * received, so that when a @context @type is called, it can fetch the
   * credentials (`session.getConfig()`), knowing they will have already been
   * validated against this schema.
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
   * **NOTE**: For more information on using the credentials object from a client,
   * see [Sockethub Client](https://github.com/sockethub/sockethub/wiki/Sockethub-Client)
   *
   * Valid AS object for setting XMPP credentials:
   *
   * @example
   *
   * {
   *   '@type': 'set',
   *   context: 'xmpp',
   *   actor: {
   *     '@id': 'testuser@jabber.net',
   *     '@type': 'person',
   *     displayName: 'Mr. Test User'
   *   },
   *   object: {
   *     '@type': 'credentials',
   *     server: 'jabber.net',
   *     username: 'testuser',
   *     password: 'asdasdasdasd',
   *     port: 5223,
   *     resource: 'phone'
   *   }
   * }
   **/
  get schema() {
    return PlatformSchema;
  }

  get config() {
    return {
      persist: true,
      requireCredentials: [ 'connect' ]
    };
  };

  /**
   * Connect to the XMPP server.
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} credentials credentials object // TODO LINK
   * @param {object} done callback when job is done // TODO LINK
   *
   * @example
   *
   * {
   *   context: 'xmpp',
   *   '@type': 'connect',
   *   actor: {
   *     '@id': 'slvrbckt@jabber.net/Home',
   *     '@type': 'person',
   *     displayName: 'Nick Jennings',
   *     userName: 'slvrbckt'
   *   }
   * }
   */
  connect(job, credentials, done) {
    if (this.__client) {
      // TODO verify client is actually connected
      this.debug('client connection already exists for ' + job.actor['@id']);
      return done();
    }
    this.debug('connect called for ' + job.actor['@id']);
    this.__client = client(utils.buildXmppCredentials(credentials));
    this.__client.on("offline", (a) => {
      console.log("offline", a);
    });

    this.__client.start().then(() => {
      // connected
      this.debug('connection successful');
      this.__registerHandlers();
      return done();
    }).catch((err) => {
      this.debug(`connect error: ${err}`);
      delete this.__client;
      return done(err);
    });
  };

  /**
   * Join a room, optionally defining a display name for that room.
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} done callback when job is done // TODO LINK
   *
   * @example
   *
   * {
   *   context: 'xmpp',
   *   '@type': 'join',
   *   actor: {
   *     '@type': 'person',
   *     '@id': 'slvrbckt@jabber.net/Home',
   *     displayName: 'Mr. Pimp'
   *   },
   *   target: {
   *     '@type': 'room',
   *     '@id': 'PartyChatRoom@muc.jabber.net'
   *   }
   * }
   */
  join(job, done) {
    this.debug(`sending join from ${job.actor['@id']} to ` +
               `${job.target['@id']}/${job.actor.displayName}`);
    // TODO optional passwords not handled for now
    // TODO investigate implementation reserved nickname discovery

    let id = job.target['@id'].split('/')[0];

    this.__client.send(xml("presence", {
      from: job.actor['@id'],
      to: `${job.target['@id']}/${job.actor.displayName || id}`
    })).then(done);
  };

  /**
   * Leave a room
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} done callback when job is done // TODO LINK
   *
   * @example
   *
   * {
   *   context: 'xmpp',
   *   '@type': 'leave',
   *   actor: {
   *     '@type': 'person',
   *     '@id': 'slvrbckt@jabber.net/Home',
   *     displayName: 'slvrbckt'
   *   },
   *   target: {
   *     '@type': 'room'
   *     '@id': 'PartyChatRoom@muc.jabber.net',
   *   }
   * }
   */
  leave(job, done) {
    this.debug(`sending leave from ${job.actor['@id']} to ` +
               `${job.target['@id']}/${job.actor.displayName}`);

    let id = job.target['@id'].split('/')[0];

    this.__client.send(xml("presence", {
      from: job.actor['@id'],
      to: `${job.target['@id']}/${job.actor.displayName}` || id,
      type: 'unavailable'
    })).then(done);
  };

  /**
   * Send a message to a room or private conversation.
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} done callback when job is done // TODO LINK
   *
   * @example
   *
   * {
   *   context: 'xmpp',
   *   '@type': 'send',
   *   actor: {
   *     '@id': 'slvrbckt@jabber.net/Home',
   *     '@type': 'person',
   *     displayName: 'Nick Jennings',
   *     userName: 'slvrbckt'
   *   },
   *   target: {
   *     '@id': 'homer@jabber.net/Home',
   *     '@type': 'user',
   *     displayName: 'Homer'
   *   },
   *   object: {
   *     '@type': 'message',
   *     content: 'Hello from Sockethub!'
   *   }
   * }
   *
   * {
   *   context: 'xmpp',
   *   '@type': 'send',
   *   actor: {
   *     '@id': 'slvrbckt@jabber.net/Home',
   *     '@type': 'person',
   *     displayName: 'Nick Jennings',
   *     userName: 'slvrbckt'
   *   },
   *   target: {
   *     '@id': 'party-room@jabber.net',
   *     '@type': 'room'
   *   },
   *   object: {
   *     '@type': 'message',
   *     content: 'Hello from Sockethub!'
   *   }
   * }
   *
   */
  send(job, done) {
    this.debug('send() called for ' + job.actor['@id']);
    // send message
    const message = xml(
      "message",
      { type: job.target['@type'] === 'room' ? 'groupchat' : 'chat', to: job.target['@id'] },
      xml("body", {}, job.object.content),
    );
    this.__client.send(message).then(done);
  };

  /**
   * @description
   * Indicate presence and status message.
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} done callback when job is done // TODO LINK
   *
   * @example
   *
   * {
   *   context: 'xmpp',
   *   '@type': 'update',
   *   actor: {
   *     '@id': 'user@host.org/Home'
   *   },
   *   object: {
   *     '@type': 'presence'
   *     presence: 'chat',
   *     content: '...clever saying goes here...'
   *   }
   * }
   */
  update(job, done) {
    this.debug('update() called for ' + job.actor['@id']);
    if (job.object['@type'] === 'presence') {
      const show = job.object.presence === 'available' ? 'chat' : job.object.show;
      const status = job.object.content || '';
      // setting presence
      this.debug('setting presence: ' + show + ' status: ' + status);
      this.__client.send(xml(show, { type: status })).then(done);
    } else {
      done('unknown object type (should be presence?): ' + job.object['@type']);
    }
  };

  /**
   * @description
   * Send friend request
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} done callback when job is done // TODO LINK
   *
   * @example
   *
   * {
   *   context: 'xmpp',
   *   '@type': 'request-friend',
   *   actor: {
   *     '@id': 'user@host.org/Home'
   *   },
   *   target: {
   *     '@id': 'homer@jabber.net/Home',
   *   }
   * }
   */
  'request-friend'(job,  done) {
    this.debug('request-friend() called for ' + job.actor['@id']);
    this.__client.send(xml("presence", { type: "subscribe", to:job.target['@id'] })).then(done);
  };

  /**
   * @description
   * Send a remove friend request
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} done callback when job is done // TODO LINK
   *
   * @example
   *
   * {
   *   context: 'xmpp',
   *   '@type': 'remove-friend',
   *   actor: {
   *     '@id': 'user@host.org/Home'
   *   },
   *   target: {
   *     '@id': 'homer@jabber.net/Home',
   *   }
   * }
   */
  'remove-friend'(job, done) {
    this.debug('remove-friend() called for ' + job.actor['@id']);
    this.__client.send(xml("presence", { type: "unsubscribe", to:job.target['@id'] })).then(done);
  };

  /**
   * @description
   * Confirm a friend request
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} done callback when job is done // TODO LINK
   *
   * @example
   *
   * {
   *   context: 'xmpp',
   *   '@type': 'make-friend',
   *   actor: {
   *     '@id': 'user@host.org/Home'
   *   },
   *   target: {
   *     '@id': 'homer@jabber.net/Home',
   *   }
   * }
   */
  'make-friend'(job, done) {
    this.debug('make-friend() called for ' + job.actor['@id']);
    this.__client.send(xml("presence", { type: "subscribe", to:job.target['@id'] })).then(done);
  };

  /**
   * Indicate an intent to observe something (ie. get a list of users in a room).
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} done callback when job is done // TODO LINK
   *
   * @example
   *
   *  {
   *    context: 'xmpp',
   *    '@type': 'observe',
   *    actor: {
   *      '@id': 'slvrbckt@jabber.net/Home',
   *      '@type': 'person'
   *    },
   *    target: {
   *      '@id': 'PartyChatRoom@muc.jabber.net',
   *      '@type': 'room'
   *    },
   *    object: {
   *      '@type': 'attendance'
   *    }
   *  }
   *
   *  // The above object might return:
   *  {
   *    context: 'xmpp',
   *    '@type': 'observe',
   *    actor: {
   *      '@id': 'PartyChatRoom@muc.jabber.net',
   *      '@type': 'room'
   *    },
   *    target: {
   *      '@id': 'slvrbckt@jabber.net/Home',
   *      '@type': 'person'
   *    },
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
   */
  observe(job, done) {
    this.debug('sending observe from ' + job.actor['@id'] + ' for ' + job.target['@id']);
    this.__client.send(xml("iq",  {
      id: 'muc_id',
      type: 'get',
      from: job.actor['@id'],
      to: job.target['@id']
    }, xml("query", {xmlns: 'http://jabber.org/protocol/disco#items'}))).then(done);
  };

  /**
   * Called when it's time to close any connections or clean data before being wiped
   * forcefully.
   * @param {function} done - callback when complete
   */
  cleanup(done) {
    this.debug('attempting to close connection now');
    this.__forceDisconnect = true;
    this.__client.stop();
    done();
  };

  __registerHandlers() {
    const ih = new IncomingHandlers(this);
    this.__client.on('close', ih.close.bind(ih));
    this.__client.on('error', ih.error.bind(ih));
    this.__client.on('online', ih.online.bind(ih));
    this.__client.on('stanza', ih.stanza.bind(ih));
  };
}

module.exports = XMPP;
