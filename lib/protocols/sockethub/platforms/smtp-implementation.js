if (typeof(gpg) !== 'object') {
  gpg = require('gpg');
}
if (typeof(nodemailer) !== 'object') {
  nodemailer = require('nodemailer');
}
var promising = require('promising');

function joinAddresses(a) {
  var r = '';
  for (var i = 0, len = a.length; i < len; i = i + 1) {
    if (a[i].name) {
      r = r + a[i].name + '<' + a[i].address + '>, ';
    } else {
      r = r + a[i].address + ', ';
    }
  }
  return r.slice(0, -2);
}

function clearSign(text, homedir, passphrasefile, cb) {
  var promise = promising();
  var args=[
    '--homedir', homedir,
    '--passphrase-file', passphrasefile
  ];
  gpg.clearsign(text, args, function (err, signed) {
    if (err) {
      promise.reject(err);
    } else {
      promise.fulfill(signed);
    }
  });
  return promise;
}

function prepMessage(session, job, creds, transport) {
  var promise = promising();
  var msg = {
    to: joinAddresses(job.target.to),
    from: joinAddresses([job.actor]),
    subject: job.object.subject,
    text: job.object.text
  };

  //console.log('gnupg?', creds.gnupg);
  if (creds.gnupg) {
    session.log('use gnupg');
    clearSign(msg.text, creds.gnupg.homedir, creds.gnupg.passphrasefile)
    .then(function (signed) {
      //console.log('clearsigned ' + signed.toString());
      msg.text = signed+'\n';
      promise.fulfill(msg);
    }, function (err) {
      promise.reject(err);
    });
  } else {
    promise.fulfill(msg);
  }
  return promise;
}


var Smtp = function () {
  var userTransports = {};
  var pub = {};
  var session;
  var sessionId;

  pub.init = function (sess) {
    var promise = promising();
    sess.log('smtp initialized');
    this.session = sess;
    this.sessionId = sess.getSessionID();
    this.userTransports = {};
    promise.fulfill();
    return promise;
  };

  pub.send = function (job) {
    this.session.log('got send job');
    console.log('job:',job);
    var promise = promising();
    var transport;

    var _this = this;
    this.session.getConfig('credentials').then(function (credentials) {
      //console.log('credentials:',credentials);
      if (typeof credentials[job.actor.address].smtp === 'undefined') {
        promise.fulfill('no smtp credentials found for address ' + job.actor.address, false);
      } else {
        _this.session.log('got smtp credentials for ' + job.actor.address);
        creds = credentials[job.actor.address].smtp;
      }

      //_this.session.log('testing for userTransport '+_this.sessionId);
      //console.log('ut;'+typeof _this.userTransports[_this.sessionId]);
      if ((typeof _this.userTransports[_this.sessionId] !== 'undefined') &&
          (typeof _this.userTransports[_this.sessionId][job.actor.address] !== 'undefined')) {
        _this.session.log('getting existing transport for this sessionId' + _this.sessionId);
        transport = _this.userTransports[_this.sessionId][job.actor.address];
      } else {
        _this.session.log('initializing new transport for this sessionId' + _this.sessionId);
        var obj = {
          host : creds.host,
          auth: {
            user: creds.username,
            pass: creds.password
          }
        };
        if (creds.domain) {
          obj.domain = creds.domain;
        }
        if (creds.port) {
          obj.port = creds.port;
        }
        if (obj.port === '587') {
          obj.secureConnection = false;
        } else if (creds.secureConnection) {
          obj.secureConnection = (creds.secure) ? creds.secure : false;
        }

        //console.debug('transport obj: ', obj);
        transport = nodemailer.createTransport("SMTP", obj);
        //userTransports[_this.session.getSessionID()] = {};
        //userTransports[_this.session.getSessionID()][job.actor.address] = transport;
      }

      _this.session.log('preparing to prep & send message');
      // prep message and send upon return
      prepMessage(_this.session, job, creds, transport)
      .then(function (msg) {
        console.log('tq)');
        msg.text += '\n\n---\nSent with Sockethub.\nhttp://sockethub.org\n';
        transport.sendMail(msg, function (err) {
          if (err) {
            promise.reject(err.message);
          } else {
            promise.fulfill(null, true);
          }
        });
      }, function (err) {
        promise.reject(err);
      });

    }, function (err) {
      promise.reject(err);
    });

    return promise;
  };

  pub.cleanup = function () {
    var promise = promising();
    delete this.userTransports[this.sessionId];
    this.session = '';
    this.sessionId = '';
    promise.fulfill();
    return promise;
  };

  return pub;
};

module.exports = Smtp;