if (typeof(nodemailer) !== 'object') {
  nodemailer = require('nodemailer');
}
var promising = require('promising'),
  config = require('../../../../config').config,
  gpg = require('gpg'),
  POP3Client = require("node-poplib");

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

function sign(msg, config, cb) {
  var args = [
    '--homedir', config.HOMEDIR,
    '-u', config.USERNAME,
    '--passphrase-file', config.PASSPHRASEFILE
  ];
  gpg.clearsign(msg, args, cb);
}

function sendMail(options, msg, promise) {
  console.log(options);
  console.log(msg);
  var smtpTransport = nodemailer.createTransport('SMTP', options);
  smtpTransport.sendMail(msg, function(err, res) {
    console.log(err);
    console.log(res);
    promise.fulfill(err, res);
  });
}
module.exports = {
  send: function(job, session) {
    session.log('got send job');
    var promise = promising();
    session.getConfig('credentials').then(function (credentials) {
      console.log(job);
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
          user: creds.user,
          pass: creds.password
        }
      }, msg = {
        to: joinAddresses(job.target.to),
        cc: joinAddresses(job.target.cc),
        bcc: joinAddresses(job.target.bcc),
        from: joinAddresses([job.actor]),
        subject: job.object.subject,
        body: job.object.body
      };
        
      if(job.object.ref) {
        msg.headers = {
          'In-Reply-To': job.object.ref,
          'References': [job.object.ref]
        }
      }
      console.log('config:');
      console.log(config);
      if(config.GPG) {
        sign(msg.body, config.GPG, function(err, signed) {
          console.log('signed!');
          console.log(err);
          console.log(signed);
          if(err) {
            promise.reject(err);
          } else {
            msg.body = signed;
            sendMail(options, msg, promise);
          }
        });
      } else {
        console.log('no GPG config found!');
        sendMail(options, msg, promise);
      }
    }, function (msg) {
      promise.reject(msg);
    });
    return promise;
  },
  retrieve: function(job, session) {
    var creds = job.credentials;
    client = new POP3Client(creds.port, creds.host, creds.tls);
    client.on("error", function(err) {
      if (err.errno === 111) {
        console.log("Unable to connect to server");
      } else {
        console.log("Server error occurred");
        console.log(err);
      }
    });
    client.on("connect", function() {
      console.log("CONNECT success");
      client.auth(creds.username, creds.password);
    });
    client.on("invalid-state", function(cmd) {
      console.log("Invalid state. You tried calling " + cmd);
    });
    client.on("locked", function(cmd) {
      console.log("Current command has not finished yet. You tried calling " + cmd);
    });
    client.on("login", function(status, rawdata) {
      if (status) {
        console.log("LOGIN/PASS success");
        client.list();
      } else {
        console.log("LOGIN/PASS failed");
        client.quit();
      }
    });

    // Data is a 1-based index of messages, if there are any messages
    client.on("list", function(status, msgcount, msgnumber, data, rawdata) {
      if (status === false) {
        console.log("LIST failed");
        client.quit();
      } else {
        console.log("LIST success with " + msgcount + " element(s)");
      }
      if (msgcount > 0) {
        client.retr(1);
      } else {
        client.quit();
      }
    });
    client.on("retr", function(status, msgnumber, data, rawdata) {
      if (status === true) {
        console.log("RETR success for msgnumber " + msgnumber);
        client.dele(msgnumber);
        client.quit();
      } else {
        console.log("RETR failed for msgnumber " + msgnumber);
        client.quit();
      }
    });
    client.on("dele", function(status, msgnumber, data, rawdata) {
      if (status === true) {
        console.log("DELE success for msgnumber " + msgnumber);
        client.quit();
      } else {
        console.log("DELE failed for msgnumber " + msgnumber);
        client.quit();
      }
    });
    client.on("quit", function(status, rawdata) {
      if (status === true) {
        console.log("QUIT success");
      } else {
        console.log("QUIT failed");
      }
    });
  }
};
