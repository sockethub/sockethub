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

var tpl = require('./templates');
/**
 * Variable: verbs
 *
 * Contains all the schema definitions for any verb used in any platform.
 *
 * So all verbs, regardless of platform, are defined here first, then referenced
 * to their platform in the schemas/platforms.js
 *
 */
var verbs = {

  "send" : { "schema" : {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "actor": tpl['actor'],
        "object": {
          "type": "object",
          "required": true,
          "properties": {
            "headers": {
              "type": "object",
              "required": false
            },
            "subject": {
              "type": "string",
              "required": false
            },
            "text": {
              "type": "string",
              "required": false
            },
            "html": {
              "type": "string",
              "required": false
            },
            "date": {
              "type": "string",
              "required": false
            },
            "attachments": {
              "type": "array",
              "required": false,
              "items": {
                "type": "object",
                "properties": {
                  "fileName": {
                    "type": "string",
                    "required": true
                  },
                  "cid": {
                    "type": "string",
                    "required": false
                  },
                  "contents": {
                    "type": "string",
                    "required": false
                  },
                  "filePath": {
                    "type": "string",
                    "required": false
                  },
                  "contentType": {
                    "type": "string",
                    "required": false
                  }
                }
              }
            }
          }
        },
        "target": tpl['target']
      }
    }
  },

  "post" : { "schema" : {
      "title": "post",
      "type": "object",
      "properties": {
        "actor": tpl['actor'],
        "object": {
          "type": "object",
          "properties": {
            "text": {
              "type": "string",
              "required" : true
            }
          }
        },
        "target": tpl['target']
      }
    }
  },

  "join" : { "schema" : {
      "title": "join",
      "type": "object",
      "properties": {
        "actor": tpl['actor'],
        "object": {
          "type": "object"
        },
        "target": tpl['target']
      }
    }
  },

  "fetch" : { "schema" : {
      "title": "fetch",
      "type": "object",
      "properties": {
        "actor": tpl['actor'],
        "object": {
          "type": "object"
        }
      },
      "target": tpl['target']
    }
  },

  "request-friend" : { "schema" : {
      "title": "request-friend",
      "type": "object",
      "properties": {
        "actor": tpl['actor'],
        "target": tpl['target']
      }
    }
  },

  "remove-friend" : { "schema" : {
      "title": "remove-friend",
      "type": "object",
      "properties": {
        "actor": tpl['actor'],
        "target": tpl['target']
      }
    }
  },

  "make-friend" : { "schema" : {
      "title": "make-friend",
      "type": "object",
      "properties": {
        "actor": tpl['actor'],
        "target": tpl['target']
      }
    }
  },

  "update" : { "schema" : {
      "type": "object",
      "properties": {
        "actor": tpl['actor'],
        "object": {
          "type": "object",
          "required": true,
          "properties": {
            "type": {
              "type": "string",
              "enum": ["chat", "away", "dnd", "xa", ""],
              "required": false
            },
            "status": {
              "type": "string",
              "required": false
            },
            "roster": {
              "type": "boolean",
              "required": false
            }
          }
        },
        "target": tpl['target']
      }
    }
  },




  /**
   * INTERNAL VERBS - PLATFORMS SHOULD NOT IMPLEMENT THESE VERBS
   *
   * - ping
   * - register
   * - set
   */

  // used internally, platforms should not use this verb
  "ping" : { "schema" : {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "timestamp": {
          "type": "number",
          "required" : true
        }
      }
    }
  },

  // used internally, platforms should not use this verb
  "register" : { "schema" : {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "object" : {
          "type": "object",
          "required": true,
          "properties" : {
            "remoteStorage": {
              "type": "object",
              "required": false,
              "properties": {
                "storageInfo": {
                  "type": "object",
                  "required" : true,
                  "properties": {
                    "type": {
                      "type": "string",
                      "required": true,
                      "format": "uri"
                    },
                    "href": {
                      "type": "string",
                      "required": true,
                      "format": "uri"
                    }
                  }
                },
                "bearerToken": {
                  "type": "string",
                  "required" : true
                },
                "scope": {
                  "type": "object",
                  "required": true,
                  "patternProperties": {
                    ".*": {
                      "type": "string",
                      "enum": ["r", "rw"]
                    }
                  }
                }
              }
            },
            "secret": {
              "type": "string",
              "required": true
            }
          }
        }
      }
    }
  },

  // used internally, platforms should not use this verb
  "set" : { "schema" : {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "object": {
          "type": "object",
          "required": true
        },
        "target": {
          "type": "object",
          "additionalProperties": false,
          "required": true,
          "properties": {
            "platform": {
              "type": "string",
              "required": true
            }
          }
        }
      }
    }
  }
};
module.exports = verbs;
