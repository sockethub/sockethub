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

const IncomingHandlers = require('./lib/incoming-handlers');
const PlatformSchema = require('./lib/schema.js');


/**
 * @class XMPP
 * @constructor
 *
 * @description
 * Handles all actions related to communication via. the XMPP protocol.
 *
 * Uses the `simple-xmpp` node module as a base tool for interacting with XMPP.
 *
 * {@link https://github.com/simple-xmpp/node-simple-xmpp}
 *
 * @param {object} session {@link Sockethub.Session#object}
 *
 */
class XMPP {
  constructor(cfg) {
    cfg = (typeof cfg === 'object') ? cfg : {};
    this.id = cfg.id; // actor
    this.debug = cfg.debug;
    this.sendToClient = cfg.sendToClient;
    this.__forceDisconnect = false;
    this.__channels = [];
  }

  /**
   * Property: schema
   *
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
      persist: true
    }
  };

  /**
   * Function: connect
   *
   * Connect to the XMPP server.
   *
   * @param {object} job activiy streams object // TODO LINK
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
    this.debug('connect() called for ' + job.actor['@id']);
    this.__getClient(job.actor['@id'], credentials, (xmpp) => {
      done();
    });
  };

  /**
   * Function: join
   *
   * Join a room, optionally defining a display name for that room.
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} credentials credentials object // TODO LINK
   * @param {object} done callback when job is done // TODO LINK
   *
   * @example
   *
   * {
   *   context: 'xmpp',
   *   '@type': 'join',
   *   actor: {
   *     '@type': 'person'
   *     '@id': 'slvrbckt@jabber.net/Home',
   *   },
   *   object: {
   *     '@type': 'person',
   *     '@id': 'slvrbckt@jabber.net/Home',
   *     displayName: 'Mr. Pimp'
   *   },
   *   target: {
   *     '@type': 'room'
   *     '@id': 'PartyChatRoom@muc.jabber.net',
   *   }
   * }
   *
   */
  join(job, credentials, done) {
    this.debug('join() called for ' + job.actor['@id']);
    this.__getClient(job.actor['@id'], credentials, (xmpp) => {
      // send join
      this.debug('sending join to ' + `${job.target['@id']}/${job.actor.displayName}`);
      let id = job.target['@id'].split('/')[0];
      xmpp.join(
          `${job.target['@id']}/${job.actor.displayName || id}`
          // TODO optional passwords not handled for now
      );
      done();
    });
  };

  /**
   * Function: send
   *
   * Send a message to a room or private conversation.
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} credentials credentials object // TODO LINK
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
  send(job, credentials, done) {
    this.debug('send() called for ' + job.actor['@id']);
    this.__getClient(job.actor['@id'], credentials, (xmpp) => {
      // send message
      this.debug('sending message to ' + job.target['@id']);
      xmpp.send(
          job.target['@id'],
          job.object.content,
          job.target['@type'] === 'room' ? 'groupchat' : 'chat'
      );
      done();
    });
  };

  /**
   * Function: update
   *
   * @description
   * Indicate presence and status message.
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} credentials credentials object // TODO LINK
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
  update(job, credentials, done) {
    this.debug('update() called for ' + job.actor['@id']);
    this.__getClient(job.actor['@id'], credentials, (xmpp) => {
      if (job.object['@type'] === 'presence') {
        const show = job.object.presence === 'available' ? 'chat' : job.object.show;
        const status = job.object.content || '';
        // setting presence
        this.debug('setting presence: ' + show + ' status: ' + status);
        xmpp.setPresence(show, status);
        this.debug('requesting XMPP roster');
        xmpp.getRoster();
        done();
      } else {
        done('unknown object type (should be presence?): ' + job.object['@type']);
      }
    });
  };

  /**
   * Function: request-friend
   *
   * @description
   * Send friend request
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} credentials credentials object // TODO LINK
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
  'request-friend'(job, credentials, done) {
    this.debug('request-friend() called for ' + job.actor['@id']);
    this.__getClient(job.actor['@id'], credentials, (xmpp) => {
      this.debug('request friend ' + job.target['@id']);
      xmpp.subscribe(job.target['@id']);
    });
  };

  /**
   * Function: remove-friend
   *
   * @description
   * Send a remove friend request
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} credentials credentials object // TODO LINK
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
  'remove-friend'(job, credentials, done) {
    this.debug('remove-friend() called for ' + job.actor['@id']);
    this.__getClient(job.actor['@id'], credentials, (xmpp) => {
      this.debug('remove friend ' + job.target['@id']);
      xmpp.unsubscribe(job.target['@id']);
    });
  };

  /**
   * Function: make-friend
   *
   * @description
   * Confirm a friend request
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} credentials credentials object // TODO LINK
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
  'make-friend'(job, credentials, done) {
    this.debug('make-friend() called for ' + job.actor['@id']);
    this.__getClient(job.actor['@id'], credentials, (xmpp) => {
      this.debug('make friend ' + job.target['@id']);
        xmpp.acceptSubscription(job.target['@id']);
      });
  };

  /**
   * Function: observe
   *
   * Indicate an intent to observe something (ie. get a list of users in a room).
   *
   * @param {object} job activity streams object // TODO LINK
   * @param {object} credentials credentials object // TODO LINK
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
  observe(job, credentials, done) {
    this.debug('observe() called by ' + job.actor['@id'] + ' for ' + job.target['@id']);
    this.__getClient(job.actor['@id'], credentials, (xmpp) => {
      const stanza = new xmpp.Element('iq', {
        id: 'muc_id',
        type: 'get',
        from: job.actor['@id'],
        to: job.target['@id']
      });
      stanza.c('query', {xmlns: 'http://jabber.org/protocol/disco#items'});
      xmpp.conn.send(stanza);
      done();
    });
  };

  cleanup(done) {
    // FIXME - review this, simple-xmpp has a close func now i believe
    this.debug('should be CLOSING connection now, NOT IMPLEMENTED in node-xmpp');
    this.__forceDisconnect = true;
    if ((this.__client) &&
        (typeof this.__client === 'object') &&
        (typeof this.__client.disconnect === 'function')) {
      this.__client.disconnect();
    }
    done();
  };

  __getClient(key, credentials, cb) {
    if (this.__client) {
      return cb(this.__client);
    }

    if (! credentials) {
      throw new Error('no client found, and no credentials specified.');
    }

    this.actor = credentials.actor;

    this.__connect(key, credentials, (xmpp) => {
      this.__client = xmpp;
      this.__registerListeners();
      return cb(xmpp);
    });
  };

  __connect(key, credentials, cb) {
    this.debug('calling connect for ' + credentials.actor['@id']);
    let xmpp = client(buildXmppCredentials(credentials));

    xmpp.on("offline", (a) => {
      console.log("offline", a);
      console.log(xmpp.status);
    });

    // xmpp.on("stanza", async (stanza) => {
    //   // console.log(`stanza ${stanza}`);
    //   console.log(stanza);
    //   if (stanza.is("message")) {
    //     await xmpp.send(xml("presence", { type: "unavailable" }));
    //     // await xmpp.stop();
    //   }
    // });

    // xmpp.on("online", async (address) => {
    //   // Makes itself available
    //   console.log('xmpp online event ', address);
    //   await xmpp.send(xml("presence"));

    //   // Sends a chat message to itself
    //   const message = xml(
    //     "message",
    //     { type: "chat", to: address },
    //     xml("body", {}, "hello world"),
    //   );
    //   await xmpp.send(message);
    // });

    xmpp.on('status', (status) => {
      console.log('status: ', status);
    });

    xmpp.start().then(() => {
      cb(xmpp); // connected
      // await xmpp.send(xml("presence"));
    }).catch((err) => {
      console.log(`on start catch: ${err}`);
      this.sendToClient({
        '@type': 'error',
        object: {
          '@type': 'error',
          content: err.text || err.toString(),
          condition: err.condition || 'connection-error'
        }
      });
    });
  };

  __registerListeners() {
    const ih = new IncomingHandlers(this);
    this.__client.on('close', ih.close.bind(ih));
    this.__client.on('error', ih.error.bind(ih));
    this.__client.on('online', ih.online.bind(ih));
    this.__client.on('stanza', ih.__stanza.bind(ih));
  };
}

function buildXmppCredentials(credentials) {
  const [ username, server ] = credentials.object.username.split('@');
  let xmpp_creds = {
    service: server,
    username: username,
    password: credentials.object.password
  };
  if (credentials.object.resource) {
    xmpp_creds.resource = credentials.object.resource;
  }
  return xmpp_creds;
}

module.exports = XMPP;