let kue               = require("kue"),
    nconf             = require("nconf"),
    Debug             = require("debug"),
    domain            = require("domain"),
    dsCrypt           = require("dead-simple-crypt"),
    activity          = require("activity-streams")(nconf.get("activity-streams:opts")),
    randToken         = require("rand-token"),
    ArrayKeys         = require("array-keys");

let Session           = require("./session");

let sockethubID;
let secret;

function Worker(cfg) {
  sockethubID    = cfg.id;
  secret         = cfg.secret;
  this.socket    = cfg.socket;
  this.platforms = cfg.platforms;
  this.sockets   = new ArrayKeys();
  this.id = randToken.generate(16);

  // TODO is there a way to get a callback when a kue is successfully created?
  let redisCfg = nconf.get("redis");
  if (redisCfg.url) {
    redisCfg = redisCfg.url;
  }
  this.queue = kue.createQueue({
    prefix: "sockethub:" + sockethubID + ":queue",
    redis: redisCfg
  });

  this.Platforms = [];
  for (let i = 0, len = this.platforms.length; i < len; i++) {
    try {
      this.Platforms[this.platforms[i]] = require("sockethub-platform-" + this.platforms[i]);
    } catch (e) {
      throw new Error(e);
    }
  }
}


Worker.prototype.boot = function () {
  let self = this;
  let debug = Debug("sockethub:worker:" + self.socket.id);
  debug("initializing ", this.id);

  self.queue.process(self.socket.id, function (job, done) {
    job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, secret));

    debug("got job: " + job.data.msg["@type"], self.id);

    let idebug = Debug("sockethub:worker:" + self.socket.id + ":" + job.data.msg.context);

    let platform = self.sockets.getRecord(job.data.msg.context);

    if ((! platform) && (job.data.msg["@type"] === "cleanup")) {
      return done();
    } else if (! platform) {
      debug("creating new platform instance of " + job.data.msg.context + " for " + self.socket.id);

      let session = new Session({
        sockethubID: sockethubID,
        platform: job.data.msg.context,
        secret: secret,
        socket: self.socket
      });

      platform = {
        id: job.data.msg.context,
        module: new self.Platforms[job.data.msg.context](session),
        session: session,
        socket: self.socket
      };

      self.sockets.addRecord(platform);
    }

    // call verb if it exists
    let activityStream = job.data.msg;
    idebug("calling: " + activityStream["@type"]);

    let d = domain.create();

    let _callback = (function (called) {
      return function (err, obj) {
        if (called) { return; }
        called = true;
        d.exit();
        done(err, obj);
      };
    })(false);

    d.on("error", function (err) {
      idebug("caught error: ", err.stack);
      // cleanup module
      platform.module.cleanup(function () {
        platform.session.connectionManager.removeAll();
        self.sockets.removeRecord(platform.id); idebug("disposing of domain");
      });
      done(new Error(err));
    });

    let t = d.run(function () {
      if (activityStream["@type"] === "cleanup") {
        // call cleanup without an job object
        platform.module[activityStream["@type"]](_callback);
      } else {
        // normal call params to platforms are `job` then `callback`
        platform.module[activityStream["@type"]](activityStream, _callback);
      }
    });

    if (activityStream["@type"] === "cleanup") {
      setTimeout(function (platform) {
        idebug("end of cleanup, calling platform.session.connection.removeAll()");
        platform.session.connectionManager.removeAll();
      }, 5000, platform);
    }

  });
};

module.exports = Worker;