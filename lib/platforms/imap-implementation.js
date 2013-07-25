
var promising = require('promising');
var IMAP = require('imap');

var ImapImplementation = function(session) {
  this.session = session;
};

ImapImplementation.prototype = {
  fetch: function(job) {
    var promise = promising();
    var session = this.session;
    this.session.getConfig('credentials').then(function(credentials) {
      var actorCredentials = credentials[job.actor.address], imapConfig;
      if (!(actorCredentials && (imapConfig = actorCredentials.imap))) {
        console.log("HAVE CREDENTIALS", credentials);
        console.log('act', actorCredentials);
        console.log('imap', imapConfig);
        promise.fulfill("no IMAP credentials for address '" + job.actor.address + "'!", false);
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
      if (! options.page) options.page = 1;
      if (! options.perPage) options.perPage = 10;
      if (! options.includeBody) options.includeBody = false;

      var imap = new IMAP(tweakedConfig);

      function parseAddress(string) {
        var md = string.match(/^([^<]+)<([^>]+)>$/);
        if(md) {
          return { name: md[1].replace(/(?:^\s+|\s+)$/g, ''), address: md[2] };
        } else {
          return { name: string.split('@')[0], address: string };
        }
      }

      function addressFieldParser(field) {
        return function(string) {
          var result = parseAddress(string);
          result.field = field;
          return result;
        };
      }

      function receivedMessage(headers, body) {
        session.send({
          verb: 'send',
          actor: parseAddress(headers.from[0]),
          object: {
            subject: headers.subject[0],
            date: headers.date[0],
            text: body,
            messageId: headers['message-id'][0]
          },
          target: (headers.to ? headers.to.map(addressFieldParser('to')) : []).
            concat(headers.cc ? headers.cc.map(addressFieldParser('cc')) : []).
            concat(headers.bcc ? headers.bcc.map(addressFieldParser('bcc')) : [])
        });
      }

      imap.connect(function(err) {
        if (err) {
          promise.reject(err);
        } else {
          imap.openBox('INBOX', true, function (err2, mailbox) {
            if (err2) {
              promise.reject(err2);
            } else {
              var criteria = ['ALL'];
              if (options.messageId) {
                criteria = [['HEADER', 'Message-Id', options.messageId]];
              }
                imap.search(criteria, function(err3, results) {
                if (err3) {
                  console.error("FAILED TO SEARCH IMAP", err3);
                  promise.reject(err3);
                } else if (results.length > 0) {
                  var total = results.length;
                  var offset = (options.page - 1) * options.perPage;
                  var reverseOffset = total - offset;
                  var reverseOffsetEnd = reverseOffset - options.perPage;
                  var seqIds = results.slice(reverseOffsetEnd, reverseOffset);
                  promise.fulfill({
                    total: total,
                    perPage: options.perPage,
                    page: options.page,
                    count: seqIds.length
                  });
                  imap.fetch(seqIds, {
                    headers: ['from', 'to', 'subject', 'date', 'message-id'],
                    body: options.includeBody,
                    cb: function (fetch) {
                      var headers, body;
                      fetch.on('message', function (msg) {
                        msg.on('headers', function (h) { headers = h; });
                        if(options.includeBody) {
                          msg.on('data', function (chunk) { body += chunk; });
                        }
                        msg.on('end', function () {
                          receivedMessage(headers, body);
                        });
                      });
                    }
                  }, function (err4) {
                    if (err4) {
                      console.error("FAILED TO FETCH FROM IMAP", err4);
                    } else {
                      imap.logout();
                    }
                  });
                } else {
                  imap.logout();
                }
              });
            }
          });
        }
      });
    });
    return promise;
  }
};

module.exports = ImapImplementation;
