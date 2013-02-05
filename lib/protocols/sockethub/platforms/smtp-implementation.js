if (mailer === undefined) {
  mailer = require("mailer");
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
  message: function(job, session) {
    var promise = promising();
    session.getConfig('credentials').then(function (credentials) {
      if (!credentials[job.actor.address].smtp) {
        promise.fulfill('no smtp credentials found for address '+job.actor.address, false);
      } else {
        creds = credentials[job.actor.address].smtp;
      }
      var obj = {
        host : creds.host,
        port : "587",
        domain : (creds.domain) ? creds.domain : '',
        to: joinAddresses(job.target.to),
        from: joinAddresses([job.actor]),
        subject: job.object.subject,
        body: job.object.body,
        authentication: "login",
        username: creds.username,
        password: creds.password
      };
      mailer.send(obj, promise.fulfill);
    });
    return promise;
  }
};
