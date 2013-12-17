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

module.exports = {
  actor: {
    "type": "object",
    "required": true,
    "properties": {
      "name": {
        "type": "string",
        "required": false
      },
      "address": {
        "type": "string",
        "required": true,
        "pattern": "^[a-zA-Z0-9]+"
      }
    }
  },
  target: {
    "type": "array",
    "required": true,
    "items": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "required": false
        },
        "address": {
          "type": "string",
          "required": true
        },
        "field": {
          "type": "string",
          "required": false
        }
      }
    }
  }
};