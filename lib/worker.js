const kue               = require('kue'),
      nconf             = require('nconf'),
      Debug             = require('debug'),
      domain            = require('domain'),
      dsCrypt           = require('dead-simple-crypt'),
      activity          = require('activity-streams')(nconf.get('activity-streams:opts')),
      randToken         = require('rand-token');

const Session           = require('./session');

let sockethubID, secret;

function Worker(cfg) {
  sockethubID    = cfg.id;
  secret         = cfg.secret;
  this.socket    = cfg.socket;
  this.platforms = cfg.platforms;
  this.sockets   = new Map();
  this.id = randToken.generate(16);

  // TODO is there a way to get a callback when a kue is successfully created?
  let redisCfg = nconf.get('redis');
  if (redisCfg.url) {
    redisCfg = redisCfg.url;
  }
  this.queue = kue.createQueue({
    prefix: 'sockethub:' + sockethubID + ':queue',
    redis: redisCfg
  });

  this.Platforms = [];
  for (let i = 0, len = this.platforms.length; i < len; i++) {
    try {
      this.Platforms[this.platforms[i]] = require('sockethub-platform-' + this.platforms[i]);
    } catch (e) {
      throw new Error(e);
    }
  }
}


Worker.prototype.boot = function () {
  const debug = Debug('sockethub:worker:' + this.socket.id);
  debug('initializing ', this.id);

  this.queue.process(this.socket.id, (job, done) => {
    job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, secret));

    debug('got job: ' + job.data.msg['@type'], this.id);

    const idebug = Debug('sockethub:worker:' + this.socket.id + ':' + job.data.msg.context);

    let platform = this.sockets.get(job.data.msg.context);

    if ((! platform) && (job.data.msg['@type'] === 'cleanup')) {
      return done();
    } else if (! platform) {
      debug('creating new platform instance of ' + job.data.msg.context + ' for ' + this.socket.id);

      const session = new Session({
        sockethubID: sockethubID,
        platform: job.data.msg.context,
        secret: secret,
        socket: this.socket
      });

      platform = {
        id: job.data.msg.context,
        module: new this.Platforms[job.data.msg.context](session),
        session: session,
        socket: this.socket
      };

      this.sockets.set(platform.id, platform);
    }

    // call verb if it exists
    const activityStream = job.data.msg;
    idebug('calling: ' + activityStream['@type']);

    const d = domain.create();

    const _callback = ((called) => {
      return (err, obj) => {
        if (called) { return; }
        called = true;
        d.exit();
        done(err, obj);
      };
    })(false);

    d.on('error', (err) => {
      idebug('caught error: ', err.stack);
      // cleanup module
      platform.module.cleanup(() => {
        platform.session.connectionManager.removeAll();
        this.sockets.delete(platform.id); idebug('disposing of domain');
      });
      done(new Error(err));
    });

    const t = d.run(() => {
      if (activityStream['@type'] === 'cleanup') {
        // call cleanup without an job object
        platform.module[activityStream['@type']](_callback);
      } else {
        // normal call params to platforms are `job` then `callback`
        platform.module[activityStream['@type']](activityStream, _callback);
      }
    });

    if (activityStream['@type'] === 'cleanup') {
      setTimeout((platform) => {
        idebug('end of cleanup, calling platform.session.connection.removeAll()');
        platform.session.connectionManager.removeAll();
      }, 5000, platform);
    }

  });
};

module.exports = Worker;