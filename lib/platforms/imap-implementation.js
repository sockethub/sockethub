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

var ImapImplementation = function(session) {
  this.session = session;
};

ImapImplementation.prototype = {
  fetch: function(job) {
    var q = Q.defer();
    var session = this.session;
    this.session.getConfig('credentials', job.actor.address).then(function(credentials) {
      try {
        var actorCredentials = credentials.object, imapConfig;
        if (!(actorCredentials && (imapConfig = actorCredentials.imap))) {
          console.log("HAVE CREDENTIALS", credentials);
          console.log('act', actorCredentials);
          console.log('imap', imapConfig);
          q.resolve("no IMAP credentials for address '" + job.actor.address + "'!", false);
          return;
        }

        // sockethub's email credentials use 'username' instead of 'user', to match
        // naming in smtp implementation.
        var tweakedConfig = {};
        for (var key in imapConfig) {
          if (key === 'username') {
            tweakedConfig.user = imapConfig.username;
          } else {
            tweakedConfig[key] = imapConfig[key];
          }
        }
        var options = job.object;
        if (! options.page) { options.page = 1; }
        if (! options.perPage) { options.perPage = 10; }
        if (! options.includeBody) { options.includeBody = false; }

        var imap = new IMAP(tweakedConfig);
        function openInbox(cb) {
          console.log('openInbox', tweakedConfig);
          imap.once('ready', function() {
            console.log('once - ready');
            imap.openBox('INBOX', true, cb);
          });
          imap.once('error', function(err) {
            console.log('once - error');
            console.log(err);
          });
          imap.once('timeout', function(err) {
            console.log('once - timeout');
            console.log(err);
          });
          imap.once('mail', function(num) {
            console.log('you got mail! num:'+num);
          });
          imap.once('end', function() {
            console.log('once - end');
            console.log('Connection ended');
          });
          console.log('connect start');
          imap.connect();
          console.log('connect synchronously done');
        }

        openInbox(function(err, box) {
          var from = box.messages.total-(options.page*options.perPage),
              to = from+options.perPage;
          console.log('from '+from+' to '+to);
          var f = imap.seq.fetch( from+':'+ to, { bodies: '' });
          f.on('end', function() {
            console.log('from '+from+' to '+to+' end.');
          });
          f.on('message', function(msg, seqno) {
            console.log('got message', seqno);
            msg.on('body', function(stream, info) {
              console.log('got body, piping stream into parser', seqno);
              var mailparser = new MailParser();
              stream.pipe(mailparser);
              mailparser.on("end", function(mailObject){
                console.log('parsed', mailObject, seqno);
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
        });//end openInbox
      } catch(e) {
        console.log('error within getConfig callback', e);
      }
    });//end getConfig
    return q.promise;
  }//end fetch function
};

module.exports = ImapImplementation;
