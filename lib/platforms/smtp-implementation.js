/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of sockethub can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

if (typeof(gpg) !== 'object') {
  gpg = require('gpg');
}
if (typeof(nodemailer) !== 'object') {
  nodemailer = require('nodemailer');
}
var promising = require('promising');

function joinAddress(a) {
  var r = "";
  if (a.name) {
    r = a.name + '<' + a.address + '>';
  } else {
    r = a.address;
  }
  return r;
}

function joinRecipients(a) {
  var recipients = {
    to: null,
    cc: null,
    bcc: null
  };

  for (var i = 0, len = a.length, r = ""; i < len; i = i + 1, r = "") {
    r = joinAddress(a[i]) + ', ';

    if ((typeof a[i].field !== "undefined") ||
        (a[i].field === "to")) {
      recipients.to = r;
    } else if (a[i].field === "cc") {
      recipients.cc = r;
    } else if (a[i].field === "bcc") {
      recipients.bcc = r;
    } else {
      recipients.to = r;
    }

  }

  if (recipients.to === null) {
    recipients.to = "";
  } else {
    recipients.to = recipients.to.slice(0, -2);
  }

  if (recipients.cc === null) {
    recipients.cc = "";
  } else {
    recipients.cc = recipients.cc.slice(0, -2);
  }

  if (recipients.bcc === null) {
    recipients.bcc = "";
  } else {
    recipients.bcc = recipients.bcc.slice(0, -2);
  }

  return recipients;
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
  var recipients = joinRecipients(job.target);
  var msg = {
    to: recipients['to'],
    cc: recipients['cc'],
    bcc: recipients['bcc'],
    from: joinAddress(job.actor),
    subject: job.object.subject
  };

  if (job.object.attachments) {
    msg.attachments = job.object.attachments;
  }

  if (job.object.text) {
    msg.text = job.object.text;
  } else if (job.object.html) {
    msg.generateTextFromHtml = true;
  }

  if (job.object.html) {
    msg.html = job.object.html;
  }


  // set a select group of optional headers supported by Nodemailer
  if (job.object.headers) {
    if (job.object.headers.replyTo) {
      msg.replyTo = job.object.headers.replyTo;
    }

    if (job.object.headers.inReplyTo) {
      msg.inReplyTo = job.object.headers.inReplyTo;
    }

    if (job.object.headers.references) {
      msg.references = job.object.headers.references;
    }

    if (job.object.headers.messageId) {
      msg.messageId = job.object.headers.messageId;
    }
  }

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
        } else if (creds.secure) {
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
          //msg.text += '\n\n---\nSent with Sockethub.\nhttp://sockethub.org\n';
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
    promise.fulfill(null, true);
    return promise;
  };

  return pub;
};

module.exports = Smtp;