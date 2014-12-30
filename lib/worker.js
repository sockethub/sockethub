var kue               = require('kue'),
    nconf             = require('nconf'),
    Debug             = require('debug'),
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
  this.id = randToken.generate(16);

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
}


Worker.prototype.boot = function () {
  var self = this;
  var debug = Debug('sockethub:worker:' + this.platform.id);
  debug('initializing ', this.id);

  self.jobs.process(self.platform.id, function (job, done) {
    job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, secret));

    debug('got job: ' + job.data.msg.verb, self.id);

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
    var expandedMsg = activity.Stream(job.data.msg);

    idebug('calling ' + job.data.msg.verb, expandedMsg);

    var d = domain.create();
    d.on('error', function (err) {
      idebug('caught error: ', err.stack);
      done(new Error(err));
    });

    var t = d.run(function () {
      instance.module[job.data.msg.verb](expandedMsg, done);
    });

  });
};


module.exports = Worker;
