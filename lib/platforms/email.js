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

//var pop = require('./pop-implementation');
var Email = function () {
  var pub = {};
  var session;
  var smtp = require('./smtp-implementation')();
  var promising = require('promising');

  pub.schema = {
    "set": {
      "credentials" : {
        "type": "object",
        "required": false,
        "patternProperties" : {
          ".+": {
            "type": "object",
            "required": true,
            "properties": {
              "actor": {
                "type": "object",
                "required": false,
                "properties" : {
                  "name" : {
                    "name" : "name",
                    "required" : false,
                    "type": "string"
                  },
                  "address" : {
                    "name" : "address",
                    "required" : false,
                    "type": "string"
                  }
                }
              },
              "smtp": {
                "type": "object",
                "required": false,
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
                  "secure" : {
                    "name" : "secure",
                    "required" : false,
                    "type": "string"
                  },
                  "port" : {
                    "name" : "port",
                    "required" : false,
                    "type": "string"
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
              }
            }
          }
        }
      }
    }
  };

  pub.init = function (s) {
    var promise = promising();
    session = s;
    session.log('initializing');
    smtp.init(session).then(function () {
      promise.fulfill();
    }, function (err) {
      promise.reject(err);
    });
    return promise;
  };

  pub.send = function (job) {
    return smtp.send(job);
  };

  // should call each sub-modules cleanup function
  pub.cleanup = function () {
    return smtp.cleanup();
  };

  return pub;
};

module.exports = Email;