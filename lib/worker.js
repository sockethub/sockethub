var kue       = require('kue'),
    nconf     = require('nconf'),
    Debug     = require('debug'),
    assert    = require('assert'),
    domain    = require('domain'),
    dsCrypt   = require('dead-simple-crypt'),
    activity  = require('activity-streams'),
    ArrayKeys = require('array-keys');


function Worker(cfg) {
  this.id       = cfg.id;
  this.secret   = cfg.secret;
  this.platform = cfg.platform;
  this.sockets  = new ArrayKeys();

  debug = Debug('sockethub:worker:' + this.platform.id);
  debug('initializing');

  this.jobs = kue.createQueue({
    prefix: 'sockethub:' + this.id + ':queue',
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
    job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, self.secret));

    debug('got job ', job.data);

    idebug = Debug('sockethub:worker:' + self.platform.id + ':' + job.data.socket);
    mdebug = Debug('sockethub:worker:' + self.platform.id + ':' + job.data.socket + ':module');

    var instance = self.sockets.getRecord(job.data.socket);

    if (! instance) {
      debug('creating new instance for ' + job.data.socket);

      var session = {
        id: job.data.socket,
        send: function (data) {
          // TODO code for sending messages back to client
          idebug('received session.send: ', data);
        },
        debug: mdebug
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

      var d = domain.create();
      d.on('error', function (err) {
        idebug('caught error: ', err);
      });

      var result = d.run(function () {
        return instance.module[job.data.msg.verb](job.data.msg);
      });

      idebug('done ', result);
    }

  });
};


module.exports = Worker;
