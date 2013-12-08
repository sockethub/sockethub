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

/**
 * Variable: platforms
 *
 * This is the main registry for any platform that is to be recognized by
 * sockethub.
 *
 * You define the platform name, along with any verbs it'll use. This is just
 * to list the verb names. The actual verb schema is defined in the
 * schemas/verbs.js file
 */
var platforms = {

  "email" : {
    "verbs" : [ "send", "fetch" ]
  },

  "facebook" : {
    "verbs" : [ "send", "post", "fetch" ]
  },

  "twitter" : {
    "verbs" : [ "post", "fetch" ]
  },

  "xmpp" : {
    "verbs" : [ "send", "request-friend", "remove-friend", "make-friend", "update" ]
  },

  "feeds" : {
    "verbs" : [ "fetch" ]
  },

  "irc" : {
    "verbs" : [ "fetch", "update", "join", "leave", "send", "watch", "observe" ]
  }
};

module.exports = platforms;
