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

//var pop = require('./pop-implementation');
var IMAP = require('./imap-implementation');
var Q = require('q');


/**
 * Class: Email
 *
 * Handles all actions related to interacting with email.
 *
 * Protocols supported:
 *
 * - SMTP (via. the 'nodemailer' module)
 *
 * - IMAP (via. the 'imap' and 'mailparser' modules)
 *
 *
 */
function Email() {
  this.smtp = require('./smtp-implementation')();
}

Email.prototype.schema = {
  "set": {
    "credentials" : {
      "properties": {
        "object": {
          "name": "object",
          "type": "object",
          "required": true,
          "additionalProperties": false,
          "properties" : {
            "objectType" : {
              "name" : "objectType",
              "required" : true,
              "type": "string"
            },
            "smtp": {
              "type": "object",
              "required": false,
              "additionalProperties" : false,
              "properties" : {
                "host" : {
                  "name" : "host",
                  "required" : true,
                  "type": "string"
                },
                "username" : {
                  "name" : "username",
                  "required" : true,
                  "type": "string"
                },
                "password" : {
                  "name" : "password",
                  "required" : true,
                  "type": "string"
                },
                "tls" : {
                  "name" : "secure",
                  "required" : false,
                  "type": "boolean"
                },
                "port" : {
                  "name" : "port",
                  "required" : false,
                  "type": "number"
                },
                "domain" : {
                  "name" : "domain",
                  "required" : false,
                  "type": "string"
                },
                "mimeTransport" : {
                  "name" : "mimeTransport",
                  "required" : false,
                  "type": "string"
                },
                "gpg": {
                  "type": "object",
                  "required": false,
                  "properties" : {
                    "homedir" : {
                      "name" : "domain",
                      "required" : true,
                      "type": "string"
                    },
                    "passphrasefile" : {
                      "name" : "mimeTransport",
                      "required" : true,
                      "type": "string"
                    }
                  }
                }
              }
            }, /* "smtp" */
            "imap": {
              "type": "object",
              "required": false,
              "additionalProperties" : false,
              "properties": {
                "host" : {
                  "name" : "host",
                  "required" : true,
                  "type": "string"
                },
                "username" : {
                  "name" : "username",
                  "required" : true,
                  "type": "string"
                },
                "password" : {
                  "name" : "password",
                  "required" : true,
                  "type": "string"
                },
                "tls" : {
                  "name" : "secure",
                  "required" : false,
                  "type": "boolean"
                },
                "port" : {
                  "name" : "port",
                  "required" : false,
                  "type": "number"
                }
              }
            }
          }
        }
      }
    }
  }
};

Email.prototype.init = function (s) {
  var q = Q.defer();
  this.session = s;
  this.session.log('initializing');
  this.imap = new IMAP(this.session);
  this.smtp.init(this.session).then(function () {
    q.resolve();
  }, function (err) {
    q.reject(err);
  });
  return q.promise;
};

Email.prototype.send = function (job) {
  return this.smtp.send(job);
};

/**
 * Method: fetch
 *
 * Fetches messages from IMAP.
 * Expects an actor (the account to fetch from) and an object.
 *
 * The object can be empty, otherwise it can carry these options:
 *   perPage     - Number of messages to fetch per page.
 *   page        - Page number to fetch.
 *   includeBody - Include message body.
 *   property    - has to be 'seqno' for <after> and <before> to take effect
 *   after       - will only fetch imap sequence numbers strictly greater than this
 *   before      - will only fetch imap sequence numbers strictly smaller than this
 *
 * Responds with an object with the following properties:
 *   total   - Total number of messages.
 *   count   - Actual number of messages on this page.
 *   perPage - As given in options, or default 10.
 *   page    - As given in options, or default 1.
 *
 * The actual messages will be sent asynchronously, following the
 * schema of the "send" verb, but with two extra fields in the object:
 *   imapBox - always 'INBOX'.
 *   imapSeqNo - the IMAP sequence number (1 for the oldest message, etc.).
 * 
 */
Email.prototype.fetch = function (job) {
  return this.imap.fetch(job);
};

// should call each sub-modules cleanup function
Email.prototype.cleanup = function () {
  return this.smtp.cleanup();
};

module.exports = function () {
  return new Email();
};
