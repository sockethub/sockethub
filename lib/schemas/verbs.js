/**
 * Variable: verbs
 *
 * Contains all ther schema definitions for any verb used in any platform.
 *
 * So all verbs, regardless of platform, are defined here first, then referenced
 * to their platform in the schemas/platforms.js
 *
 */
var verbs = {

  "send" : { "name" : "send", "schema" : {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "actor": {
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
        "target": {
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
      }
    }
  },

  "post" : { "name" : "post", "schema" : {
      "title": "post",
      "type": "object",
      "properties": {
        "actor": {
          "type": "object",
          "required": true,
          "properties": {
            "name": {
              "type": "string",
             "required": false
            },
            "address": {
              "type": "string",
              "required": true
            }
          }
        },
        "object": {
          "type": "object",
          "properties": {
            "text": {
              "type": "string",
              "required" : true
            }
          }
        },
        "target": {
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
      }
    }
  },

  "fetch" : { "name" : "fetch", "schema" : {
      "title": "fetch",
      "type": "object",
      "properties": {
        "actor": {
          "type": "object",
          "required": true,
          "properties": {
            "name": {
              "type": "string",
             "required": false
            },
            "address": {
              "type": "string",
              "required": true
            }
          }
        },
        "object": {
          "type": "object"
        }
      },
      "target": {
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
    }
  },

  "request-friend" : { "name" : "request-friend", "schema" : {
      "title": "request-friend",
      "type": "object",
      "properties": {
        "actor": {
          "type": "object",
          "required": true,
          "properties": {
            "name": {
              "type": "string",
             "required": false
            },
            "address": {
              "type": "string",
              "required": true
            }
          }
        },
        "target": {
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
      }
    }
  },

  "remove-friend" : { "name" : "remove-friend", "schema" : {
      "title": "remove-friend",
      "type": "object",
      "properties": {
        "actor": {
          "type": "object",
          "required": true,
          "properties": {
            "name": {
              "type": "string",
             "required": false
            },
            "address": {
              "type": "string",
              "required": true
            }
          }
        },
        "target": {
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
      }
    }
  },

  "make-friend" : { "name" : "make-friend", "schema" : {
      "title": "make-friend",
      "type": "object",
      "properties": {
        "actor": {
          "type": "object",
          "required": true,
          "properties": {
            "name": {
              "type": "string",
             "required": false
            },
            "address": {
              "type": "string",
              "required": true
            }
          }
        },
        "target": {
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
      }
    }
  },

  "update" : { "name" : "update", "schema" : {
      "type": "object",
      "properties": {
        "actor": {
          "type": "object",
          "required": true,
          "properties": {
            "address": {
              "required": true
            }
          }
        },
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
        "target": {
          "type": "array",
          "required": false,
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
  "ping" : { "name" : "ping", "schema" : {
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
  "register" : { "name" : "register", "schema" : {
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
  "set" : { "name" : "set", "schema" : {
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
