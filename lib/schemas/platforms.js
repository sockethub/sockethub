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
    "verbs" : [ "send" ]
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

  "rss" : {
    "verbs" : [ "fetch" ]
  }
};

module.exports = platforms;