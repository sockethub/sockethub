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

module.exports = {
  send: function(job, session) {
    session.log('got send job');
    var promise = promising();
    session.getConfig('credentials').then(function (credentials) {
      //console.log(job);
      //console.log(session);
      //return;
      //if (typeof credentials[job.actor.address].smtp === 'undefined') {
      //  promise.fulfill('no smtp credentials found for address '+job.actor.address, false);
      //} else {
      //  session.log('got smtp credentials for '+job.actor.address);
      //  creds = credentials[job.actor.address].smtp;
      //}
      creds = job.credentials;

      var options = {
        host : creds.host,
        port : '587',
        secureConnection: false,
        auth: {
          user: creds.username,
          pass: creds.password
        }
      }, msg = {
        to: joinAddresses(job.target.to),
        cc: joinAddresses(job.target.cc),
        bcc: joinAddresses(job.target.bcc),
        from: joinAddresses([job.actor]),
        subject: job.object.subject,
        body: job.object.text
      };
      if(job.object.ref) {
        msg.headers = {
          'In-Reply-To': ref,
          'References': [ref]
        }
      }
      console.log(options);
      console.log(msg);
      var smtpTransport = nodemailer.createTransport('SMTP', options);
      smtpTransport.sendMail(msg, function(err, res) {
        console.log(err);
        console.log(res);
        promise.fulfill(err, res);
      });
    }, function (msg) {
      promise.reject(msg);
    });
    return promise;
  }
};
