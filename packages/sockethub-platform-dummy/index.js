var packageJSON = require('./package.json');
var request = require('request');

function Dummy(session) {
  this.session = session;
}

Dummy.prototype.schema = {
  version: packageJSON.version,
  credentials: {},
  messages: {}
};

Dummy.prototype.fetch = function (job, cb) {
  var self = this;
  self.session.debug('using request on ' + job.target.id);
  request(job.target.id)
    .on('error', function (err) {
      self.session.debug('error received: ', err);
      cb(err);
    })

    .on('response', function (resp) {
      self.session.debug('response received');
      //self.session.send(resp);
      //cb(null);
    })

    .on('end', function () {
      self.session.debug('end event');
      cb(null);
    });
};

Dummy.prototype.send = function (job, cb) {
  cb();
};

Dummy.prototype.error = function (job, cb) {
  cb();
};

Dummy.prototype.cleanup = function (cb) {
  cb();
};

module.exports = Dummy;
