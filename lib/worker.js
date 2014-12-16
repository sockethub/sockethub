var kue       = require('kue'),
    nconf     = require('nconf'),
    debug     = require('debug'),
    domain    = require('domain'),
    dsCrypt   = require('dead-simple-crypt'),
    activity  = require('activity-streams');
    ArratKeys = require('array-keys');


function Worker(cfg) {
  this.id       = cfg.id;
  this.secret   = cfg.secret;
  this.platform = cfg.platform;

  debug = debug('sockethub:worker:' + this.platform.id);
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
}


Worker.prototype.boot = function () {
  var self = this;

  self.jobs.process(self.platform.id, function (job, done) {
    job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, self.secret));
    debug('got job ', job.data);


  });

};


module.exports = Worker;
