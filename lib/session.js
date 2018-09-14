const nconf             = require('nconf'),
      assert            = require('assert'),
      Store             = require('secure-store-redis'),
      Debug             = require('debug'),
      ArrayKeys         = require('array-keys'),
      ConnectionManager = require('connection-manager');

/**
 * @class Session
 * @description
 * The Session object is responsible for managing the session-specific details for
 * each platform. It provides helper methods for platforms.
 * @param {object} cfg config object
 * @param {string} cfg.platform string name of the platform
 * @param {object} cfg.socket socket object (from socket.io)
 * @param {string} cfg.socethubID the internally generated sockethubID for this run
 * @param {string} cfg.secret the internally generated secret for this run
 */

/**
 * @method Session.send
 * @description
 * send a message back to the client.
 *
 * @param {object} asobject the activity-streams object to send back to the client.
 * @example
 *  session.send({
 *    '@type': 'join',
 *    actor: {
 *      '@type': 'person',
 *      '@id': 'irc://' + object.nickname + '@' + this.credentials.object.server,
 *      displayName: object.nickname
 *    },
 *    target: {
 *      '@type': 'room',
 *      '@id': 'irc://' + this.credentials.object.server + '/' + object.channel,
 *      displayName: object.channel
 *    },
 *    object: {},
 *    published: object.time
 *  });
 */

/**
 * @method Session.debug
 * @description
 * print debug messages to console (with debug info)
 *
 * @param {string} msg the debug message to print to console
 * @example
 *  session.debug('received message for ' + job.target.actor.id);
 */

/**
 * @method Session.store
 * @description
 * an interface for storing temporary data (like credentials) in an encrypted form.
 * Nothing stored is persisted beyond the actors connection lifetime and is completely encrypted.
 */
/**
 * @method Session.store.save
 * @param {string} uid unique ID for the data being stored
 * @param {object} data data to store
 * @param {function} callback callback upon completion
 * @example
 *  self.session.store.save(job.target.id, newCreds, function (err) {
 *    ...
 *  });
 */
/**
 * @method Session.store.get
 * @param {string} uid unique ID for the data being stored
 * @param {function} callback callback upon completion
 * @example
 *  self.session.store.get(job.target.id, function (err, data) {
 *    ...
 *  });
 */

/**
 * @method Session.connectionManager
 * @description
 * TODO
 */
/**
 * @method Session.connectionManager.save
 * TODO
 */
/**
 * @method Session.connectionManager.get
 * TODO
 */
function Session(cfg) {

  const idebug = Debug('sockethub:worker:' + cfg.socket.id + ':' + cfg.platform),
        mdebug = Debug('sockethub:worker:' + cfg.socket.id + ':' + cfg.platform + ':module');

  const store = new Store({
    namespace: 'sockethub:' + cfg.sockethubID + ':store:' + cfg.platform,
    secret: cfg.secret + cfg.socket.id,
    redis: nconf.get('redis')
  });

  this.id = cfg.socket.id;

  this.send = (data) => {
    //idebug('received session.send: ', data);
    data.context = cfg.platform;
    cfg.socket.emit('message', data);
  };

  this.debug = mdebug;

  this.store = {
    save: (field, data, cb) => {
      store.save(field, data, cb);
    },
    get: (field, cb) => {
      store.get(field, cb);
    }
  };

  let cm = ConnectionManager(
    cfg.sockethubID + ':platform:' + cfg.platform,
    {
      id: cfg.socket.id,
      socket: cfg.socket,
      send: this.send,
      store: this.store,
      debug: this.debug
    });

  let _clients = new ArrayKeys({
    identifier: 'id'
  });

  this.connectionManager = {
    remove: cm.remove,
    removeAll: cm.removeAll,
    move: cm.move,
    get: (key, create, cb) => {
      assert(typeof key === 'string', 'session.client.get first param must be a unique identifier string (job.actor.id?)');
      create = (typeof create === 'object') ? create : false;

      let client = _clients.getRecord(key);
      if (client) {
        this.debug('using existing client instance. ' + client.id);
        return cb(null, client);
      }

      //
      // get credentials
      this.store.get(key, (err, creds) => {
        if (err) { return cb(err); }

        this.debug('got config for ' + key);

        //
        // check if client object already exists
        client = cm.get(key, creds);

        if ((!client) && (create)) {
          //
          // create a client
          create.id = creds.actor['@id'];
          create.credentials = creds;
          create.timeout = (typeof create.timeout === 'number') ? create.timeout : 10000;

          this.debug('creating connection manager record.');
          cm.create(create, (err, client) => {
            if (err) {
              this.debug('connection manager create failed: ', err);
              return cb(err);
            }
            _clients.addRecord(client);
            cb(null, client);
          });

        } else if (client) {
          //
          // client already exists
          this.debug('using client from connection manager. ' + client.id);
          _clients.addRecord(client);
          cb(null, client);
        } else {
          //
          // no existing client and do not create a new one
          cb('no client found, and no create object given, for ' + key);
        }
      });
    }
  };
}

module.exports = Session;
