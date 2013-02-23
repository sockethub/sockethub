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
  var args=[
    '--homedir', homedir,
    '--passphrase-file', passphrasefile
  ];
  gpg.clearsign(text, args, cb);
}

function sendMessage(session, job, creds, transport, promise) {
  var msg = {
    to: joinAddresses(job.target.to),
    from: joinAddresses([job.actor]),
    subject: job.object.subject,
    text: job.object.text
  };

  //console.log('gnupg?', creds.gnupg);
  if (creds.gnupg) {
    session.log('use gnupg');
    clearSign(msg.text, creds.gnupg.homedir, creds.gnupg.passphrasefile, function(err, signed) {
      if (err) {
        promise.reject(err);
      }
      //console.log('clearsigned ' + signed.toString());
      msg.text = signed+'\n';
    });
  }

  msg.text += '\n\n---\nSent with Sockethub.\nhttp://sockethub.org\n';
  transport.sendMail(msg, function (err) {
    if (err) {
      promise.reject(err.message);
      return;
    } else {
      promise.fulfill(null, true);
    }
  });
}

var userTransports = {};

module.exports = {
  send: function(job, session) {
    session.log('got send job');
    var promise = promising();
    var transport;

    session.getConfig('credentials').then(function (credentials) {
      //console.log('credentials:',credentials);
      if (typeof credentials[job.actor.address].smtp === 'undefined') {
        promise.fulfill('no smtp credentials found for address ' + job.actor.address, false);
      } else {
        session.log('got smtp credentials for ' + job.actor.address);
        creds = credentials[job.actor.address].smtp;
      }

      if ((typeof userTransports[session.getSessionID()] !== 'undefined') &&
          (typeof userTransports[session.getSessionID()][job.actor.address] !== 'undefined')) {
        transport = userTransports[session.getSessionID()][job.actor.address];
        sendMessage(session, job, creds, transport, promise);
      } else {
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

        console.debug('transport obj: ', obj);
        transport = nodemailer.createTransport("SMTP", obj);
        //userTransports[session.getSessionID()] = {};
        //userTransports[session.getSessionID()][job.actor.address] = transport;
        sendMessage(session, job, creds, transport, promise);
      }
    }, function (msg) {
      promise.reject(msg);
    });
    return promise;
  }
};