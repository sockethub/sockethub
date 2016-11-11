/**
 * This is a platform for sockethub implementing XMPP functionality.
 *
 * copyright 2012-2016 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the LGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of this module can be found here:
 *   git://github.com/sockethub/sockethub-platform-xmpp.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

if (typeof (xmpp) !== 'object') {
  xmpp = require('irc-factory');
}

var debug = require('debug')('sockethub-platform-xmpp');
var packageJSON = require('./package.json');


/**
 * @class XMPP
 * @constructor
 *
 * @description
 * Handles all actions related to communication via. the XMPP protocol.
 *
 * Uses the `simple-xmpp` node module as a base tool for interacting with XMPP.
 *
 * {@link https://github.com/simple-xmpp/node-simple-xmpp}
 *
 * @param {object} session {@link Sockethub.Session#object}
 *
 */
function XMPP(session) {
  this.session   = session;
  this._channels = [];
}

/**
 * Property: schema
 *
 * @description
 * JSON schema defining the @types this platform accepts.
 *
 * Actual handling of incoming 'set' commands are handled by dispatcher,
 * but the dispatcher uses this defined schema to validate credentials
 * received, so that when a @context @type is called, it can fetch the
 * credentials (`session.getConfig()`), knowing they will have already been
 * validated against this schema.
 *
 *
 * In the below example, sockethub will validate the incoming credentials object
 * against whatever is defined in the `credentials` portion of the schema
 * object.
 *
 *
 * It will also check if the incoming AS object uses a @type which exists in the
 * `@types` portion of the schema object (should be an array of @type names).
 *
 *
 * Valid AS object for setting XMPP credentials:
 * @example
 *
 *  {
 *    '@type': 'set',
 *    context: 'xmpp',
 *    actor: {
 *      '@id': 'xmpp://testuser@jabber.net',
 *      '@type': 'person',
 *      displayName: 'Mr. Test User',
 *      userName: 'testuser'
 *    },
 *    object: {
 *      '@type': 'credentials',
 *      server: 'jabber.net',
 *      username: 'testuser',
 *      password: 'asdasdasdasd',
 *      port: 6697,
 *      resource: 'me'
 *    }
 *  }
 *
 *
 */
IRC.prototype.schema = {
  "version": packageJSON.version,
  "messages" : {
    "required": [ '@type' ],
    "properties": {
      "@type": {
        "enum": [ 'update', 'join', 'leave', 'send', 'observe', 'announce' ]
      }
    }
  },
  "credentials" : {
    "required": [ 'object' ],
    "properties": {
      // TODO platforms shouldn't have to define the actor property if they don't want to, just credential specifics
      "actor": {
        "type": "object",
        "required": [ "@id", "displayName" ]
      },
      "object": {
        "name": "object",
        "type": "object",
        "required": [ '@type', 'username', 'password', 'server', 'resource' ],
        "additionalProperties": false,
        "properties" : {
          "@type": {
            "name": "@type",
            "type": "string"
          },
          "username" : {
            "name" : "username",
            "type": "string"
          },
          "password" : {
            "name" : "password",
            "type": "string"
          },
          "server" : {
            "name" : "server",
            "type": "string"
          },
          "port" : {
            "name": "port",
            "type": "number"
          },
          "resource": {
            "name": "resource",
            "type": "string"
          }
        }
      }
    }
  }
};