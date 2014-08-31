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

var tpl = require('./templates');

/*
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
      "required": ['actor', 'object', 'target'],
      "properties": {
        "actor": tpl['actor'],
        "object": {
          "type": "object",
          "properties": {
            "headers": {
              "type": "object"
            },
            "subject": {
              "type": "string"
            },
            "text": {
              "type": "string"
            },
            "html": {
              "type": "string"
            },
            "date": {
              "type": "string"
            },
            "attachments": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ['fileName'],
                "properties": {
                  "fileName": {
                    "type": "string"
                  },
                  "cid": {
                    "type": "string"
                  },
                  "contents": {
                    "type": "string"
                  },
                  "filePath": {
                    "type": "string"
                  },
                  "contentType": {
                    "type": "string"
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
      "required": ['actor', 'object', 'target'],
      "properties": {
        "actor": tpl['actor'],
        "object": {
          "type": "object",
          "required": ['text'],
          "properties": {
            "text": {
              "type": "string"
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
      "required": ['actor', 'target'],
      "properties": {
        "actor": tpl['actor'],
        "object": {
          "type": "object"
        },
        "target": tpl['target']
      }
    }
  },

  "leave" : { "schema" : {
      "title": "leave",
      "type": "object",
      "required": ['actor', 'target'],
      "properties": {
        "actor": tpl['actor'],
        "object": {
          "type": "object",
          "properties": {
            "text": "string",
            "required": false
          }
        },
        "target": tpl['target']
      }
    }
  },

  "observe" : { "schema" : {
      "title": "observe",
      "type": "object",
      "required": ['actor', 'target'],
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
      "required": ['actor', 'target'],
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
      "required": ['actor', 'target'],
      "properties": {
        "actor": tpl['actor'],
        "target": tpl['target']
      }
    }
  },

  "remove-friend" : { "schema" : {
      "title": "remove-friend",
      "type": "object",
      "required": ['actor', 'target'],
      "properties": {
        "actor": tpl['actor'],
        "target": tpl['target']
      }
    }
  },

  "make-friend" : { "schema" : {
      "title": "make-friend",
      "type": "object",
      "required": ['actor', 'target'],
      "properties": {
        "actor": tpl['actor'],
        "target": tpl['target']
      }
    }
  },

  "update" : { "schema" : {
      "type": "object",
      "required": ['actor', 'object', 'target'],
      "properties": {
        "actor": tpl['actor'],
        "object": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["chat", "away", "dnd", "xa", ""]
            },
            "status": {
              "type": "string"
            },
            "roster": {
              "type": "boolean"
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
      "required": ['timestamp'],
      "properties": {
        "timestamp": {
          "type": "number"
        }
      }
    }
  },

  // used internally, platforms should not use this verb
  "register" : { "schema" : {
      "type": "object",
      "additionalProperties": true,
      "required": ['object'],
      "properties": {
        "object" : {
          "type": "object",
          "required": ['secret'],
          "properties" : {
            "remoteStorage": {
              "type": "object",
              "required": ['storageInfo', 'bearerToken', 'scope'],
              "properties": {
                "storageInfo": {
                  "type": "object",
                  "required" : ['type', 'href'],
                  "properties": {
                    "type": {
                      "type": "string",
                      "format": "uri"
                    },
                    "href": {
                      "type": "string",
                      "format": "uri"
                    }
                  }
                },
                "bearerToken": {
                  "type": "string"
                },
                "scope": {
                  "type": "object",
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
              "type": "string"
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
      "required": ['object', 'target'],
      "properties": {
        "object": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "objectType": {
              "type": "string"
            }
          }
        },
        "target": tpl['target']
      }
    }
  }
};
module.exports = verbs;
