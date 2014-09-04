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

// the schema defining the platforms schema (returned from
// <protocol_name>/protocol.js, which must list the verbs and platforms
// supported, with schemas for the verbs./
module.exports = {
  "type" : "object",
  "required": ['verbs', 'platforms'],
  "properties" : {
    "verbs" : {
      "title": "verbs",
      "type": "object",
      "patternProperties": {
        ".+": {
          "type": "object",
          "required" : ['name', 'schema'],
          "properties" : {
            "name" : {
              "title" : "name",
              "type": "string"
            },
            "schema" : {
              "title" : "schema",
              "type": "object"
            }
          }
        }
      }
    },

    "platforms" : {
      "title": "platforms",
      "type": "object",
      "patternProperties": {
        ".+": {
          "type": "object",
          "required": ['name', 'verbs'],
          "properties": {
            "name": {
              "type": "string"
            },
            "verbs": {
              "type": "object"
            },
            "location": {
              "type": "string"
            }
          }
        }
      }
    }
  }
};