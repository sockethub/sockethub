/**
 * This file is part of sockethub.
 *
 * copyright 2012-2015 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the LGPL.
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

// the schema defines the general structure of the schema object which should
// be returned from platforms.
module.exports = {
  'type' : 'object',
  'required': [ 'verbs', 'credentials' ],
  'additionalProperties': false,
  'properties' : {
    'verbs' : {
      'title': 'verbs',
      'type': 'array',
      'items': {
        'type': 'string'
      },
      "minItems": 1,
      "uniqueItems": true
    },

    'credentials' : {
      'title': 'credentials',
      'type': 'object'
    }
  }
};
