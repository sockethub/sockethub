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
    "name" : "email",
    "verbs" : {
      "send" : {
        "name": "send"
      }
    }
  },

  "facebook" : {
    "name" : "facebook",
    "verbs" : {
      "send" : {
        "name": "send"
      },
      "post": {
        "name": "post"
      },
      "fetch": {
        "name": "fetch"
      }
    }
  },

  "twitter" : {
    "name" : "twitter",
    "verbs" : {
      "post": {
        "name": "post"
      },
      "fetch": {
        "name": "fetch"
      }
    }
  },

  "xmpp" : {
    "name" : "xmpp",
    "verbs" : {
      "send" : {
        "name": "send"
      },
      "request-friend" : {
        "name" : "request-friend"
      },
      "remove-friend" : {
        "name" : "remove-friend"
      },
      "make-friend" : {
        "name" : "make-friend"
      },
      "update": {
        "name" : "update"
      }
    }
  },

  "rss" : {
    "name" : "rss",
    "verbs" : {
      "fetch" : {
        "name" : "fetch"
      }
    }
  }
};

module.exports = platforms;