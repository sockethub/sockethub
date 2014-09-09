/**
 * This file is part of sockethub.
 *
 * copyright 2012-2013 Nick Jennings (https://github.com/silverbucket)
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
var Q = require('q'),
    IMAP = require('imap'),
    MailParser = require('mailparser').MailParser;

var ImapImplementation = function (session) {
  this.session = session;
};

ImapImplementation.prototype = {
  fetch: function (job) {
    var q = Q.defer();
    var session = this.session;

    this.session.getConfig('credentials', job.actor.address).then(function (credentials) {
      try {
        var creds = (credentials.object) ? credentials.object : undefined;
        if (!creds) {
          q.reject('unable to get credentials for ' + job.actor.address);
          return;
        }

        var imapConfig = (creds.imap) ? creds.imap : undefined;
        if (!imapConfig) {
          q.reject('no imap credentials found for ' + job.actor.address);
          return;
        }

        // sockethub's email credentials use 'username' instead of 'user', to match
        // naming in smtp implementation.
        var tweakedConfig = {
          host: imapConfig.host,
          user: imapConfig.username,
          password: imapConfig.password,
          tls: (typeof imapConfig.tls === 'boolean') ? imapConfig.tls : true,
          port: imapConfig.port
        };

        var options = job.object;
        if (! options.page) { options.page = 1; }
        if (! options.perPage) { options.perPage = 10; }
        if (! options.includeBody) { options.includeBody = false; }

        var imap = new IMAP(tweakedConfig);


        function openInbox(cb) {
          imap.openBox('INBOX', true, cb);
        }

        imap.once('ready', function () {
          openInbox(function(err, box) {
            if (err) {
              throw err;
            }

            var f = imap.seq.fetch( from+':'+ to, {
              bodies: (options.includeBody ? '' : 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO)'),
              struct: true
            });

            f.on('message', function(msg, seqno) {
              console.log('got message', seqno);
              msg.on('body', function(stream, info) {
                console.log('got body, piping stream into parser', seqno);
                var mailparser = new MailParser();
                stream.pipe(mailparser);
                mailparser.on("end", function(mailObject){
                  console.log('parsed', mailObject, seqno);
                  mailObject.imapBox = 'INBOX';
                  mailObject.imapSeqNo = seqno;
                  session.send({
                    timestamp: new Date(mailObject.headers.date).getTime(),
                    actor: mailObject.from,
                    target: {
                      to: mailObject.to,
                      cc: mailObject.cc,
                      bcc: mailObject.bcc
                    },
                    object: mailObject
                  });
                });
              });
            });//end f.on

            f.once('end', function () {
              console.log('Done fetching all messages!');
              imap.end();
            });

          });//end openInbox
        });

        imap.once('error', function (err) {
          q.reject(err);
        });

        imap.once('end', function () {
          console.log('Connection ended');
          q.resolve();
        });

        imap.connect();
      } catch (e) {
        console.log('error within getConfig callback', e);
        q.reject('error getting credentials: ' + e);
      }
    }, function (err) {
      q.reject('error getting credentials: ' + err);
    });//end getConfig
    return q.promise;
  }//end fetch function
};

module.exports = ImapImplementation;
