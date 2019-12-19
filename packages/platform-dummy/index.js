const packageJSON = require('./package.json'),
      request = require('request');

function Dummy(cfg) {
  cfg = (typeof cfg === 'object') ? cfg : {};
  this.id = cfg.id;
  this.debug = cfg.debug;
  this.sendToClient = cfg.sendToClient;
}

Dummy.prototype.schema = {
  version: packageJSON.version,
  credentials: {},
  messages: {}
};

Dummy.prototype.config = {};

Dummy.prototype.fetch = function (job, credentials, cb) {
  this.debug('using request on ' + job.target.id);
  request(job.target.id)
    .on('error', function (err) {
      this.debug('error received: ', err);
      cb(err);
    })

    .on('response', function (resp) {
      this.debug('response received');
      //this.sendToClient(resp);
      //cb(null);
    })

    .on('end', function () {
      this.debug('end event');
      cb(null);
    });
};

Dummy.prototype.send = function (job, credentials, cb) {
  cb();
};

Dummy.prototype.error = function (job, credentials, cb) {
  cb();
};

Dummy.prototype.cleanup = function (cb) {
  cb();
};

module.exports = Dummy;
