var kue               = require('kue'),
    nconf             = require('nconf'),
    Debug             = require('debug'),
    domain            = require('domain'),
    dsCrypt           = require('dead-simple-crypt'),
    activity          = require('activity-streams'),
    randToken         = require('rand-token'),
    ArrayKeys         = require('array-keys');

var Session           = require('./session');

var sockethubID;
var secret;

function Worker(cfg) {
  sockethubID      = cfg.id;
  secret         = cfg.secret;
  this.socket    = cfg.socket;
  this.platforms = cfg.platforms;
  this.sockets   = new ArrayKeys();
  this.id = randToken.generate(16);

  this.jobs = kue.createQueue({
    prefix: 'sockethub:' + sockethubID + ':queue',
    redis: nconf.get('redis')
  });

  this.Platforms = [];
  for (var i = 0, len = this.platforms.length; i < len; i++) {
    try {
      this.Platforms[this.platforms[i]] = require('sockethub-platform-' + this.platforms[i]);
    } catch (e) {
      throw new Error(e);
    }
  }
}


Worker.prototype.boot = function () {
  var self = this;
  var debug = Debug('sockethub:worker:' + self.socket.id);
  debug('initializing ', this.id);

  self.jobs.process(self.socket.id, function (job, done) {
    job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, secret));

    debug('got job: ' + job.data.msg.verb, self.id);

    var idebug = Debug('sockethub:worker:' + self.socket.id + ':' + job.data.msg.platform);

    var platform = self.sockets.getRecord(job.data.msg.platform);

    if ((! platform) && (job.data.msg.verb === 'cleanup')) {
      return done();
    } else if (! platform) {
      debug('creating new platform instance of ' + job.data.msg.platform + ' for ' + self.socket.id);

      var session = new Session({
        sockethubID: sockethubID,
        platform: job.data.msg.platform,
        secret: secret,
        socket: self.socket
      });

      platform = {
        id: job.data.msg.platform,
        module: new self.Platforms[job.data.msg.platform](session),
        session: session,
        socket: self.socket
      };

      self.sockets.addRecord(platform);
    }

    // call verb if it exists
    var expandedMsg = activity.Stream(job.data.msg);

    idebug('calling ' + job.data.msg.verb);//, expandedMsg);

    var d = domain.create();
    d.on('error', function (err) {
      idebug('caught error: ', err.stack);
      done(new Error(err));
    });

    var t = d.run(function () {
      platform.module[job.data.msg.verb](expandedMsg, done);
    });

    if (job.data.msg.verb === 'cleanup') {
      setTimeout(function (platform) {
        idebug('end of cleanup, calling platform.session.connection.removeAll()');
        platform.session.client.removeAll();
      }, 5000, platform);
    }

  });
};


module.exports = Worker;
