var kue               = require('kue'),
    nconf             = require('nconf'),
    Debug             = require('debug'),
    assert            = require('assert'),
    domain            = require('domain'),
    dsCrypt           = require('dead-simple-crypt'),
    Store             = require('secure-store-redis'),
    activity          = require('activity-streams'),
    randToken         = require('rand-token'),
    ArrayKeys         = require('array-keys'),
    ConnectionManager = require('connection-manager');

var sessionID;
var secret;

function Worker(cfg) {
  sessionID     = cfg.id;
  secret        = cfg.secret;
  this.platform = cfg.platform;
  this.sockets  = new ArrayKeys();
  this.workerID = randToken.generate(16);

  debug = Debug('sockethub:worker:' + this.platform.id);
  debug('initializing');

  this.jobs = kue.createQueue({
    prefix: 'sockethub:' + sessionID + ':queue',
    redis: nconf.get('redis')
  });

  try {
    this.Platform = require(this.platform.moduleName);
  } catch (e) {
    throw new Error(e);
  }

  var init = new this.Platform({id: 'init', send: function() {}});
  this.schema = init.schema;
  assert(Array.isArray(this.schema.verbs), 'platform module must provide a schema with a verbs array.');
}


Worker.prototype.boot = function () {
  var self = this;

  self.jobs.process(self.platform.id, function (job, done) {
    job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, secret));

    // wrapper for `done` callback, to ensure we encrypt the returning data
    function encDone(err, msg) {
      // TODO when jobs fail, what data is passed back?
      if (! msg) {
        msg = {};
      }

      if (! msg.error) {
        msg.error = err;
      }

      msg = dsCrypt.encrypt(JSON.stringify(msg), secret);
      done(err, msg);
    }

    debug('got job ', job.data);

    idebug = Debug('sockethub:worker:' + self.platform.id + ':' + job.data.socket);
    mdebug = Debug('sockethub:worker:' + self.platform.id + ':' + job.data.socket + ':module');

    var instance = self.sockets.getRecord(job.data.socket);

    if (! instance) {
      debug('creating new instance for ' + job.data.socket);

      var store = new Store({
        namespace: 'sockethub:' + sessionID + ':store:' + self.platform.id,
        secret: secret + job.data.socket,
        redis: nconf.get('redis')
      });

      var session = {
        id: job.data.socket,
        send: function (data) {
          // TODO code for sending messages back to client
          idebug('received session.send: ', data);
        },
        debug: mdebug,
        store: {
          save: function (field, data, cb) {
            store.get(field, data, cb);
          },
          get: function (field, cb) {
            store.get(field, cb);
          }
        },
        connection: ConnectionManager(
                        sessionID + ':platform:' + self.platform.id, {
                          id: job.data.socket,
                          socket: job.data.socket
                        })
      };

      instance = {
        id: job.data.socket,
        module: new self.Platform(session)
      };

      self.sockets.addRecord(instance);
    }

    // call verb if it exists
    if (self.schema.verbs.indexOf(job.data.msg.verb) >= 0) {
      idebug('calling ' + job.data.msg.verb);

      var expandedMsg = activity.Stream(job.data.msg);

      var d = domain.create();
      d.on('error', function (err) {
        idebug('caught error: ', err.stack);
        encDone(new Error(err));
      });

      var t = d.run(function () {
        instance.module[job.data.msg.verb](expandedMsg, encDone);
      });
    }

  });
};


module.exports = Worker;
