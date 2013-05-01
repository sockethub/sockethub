var schemas = {
  "ping" : {
    "type": "object",
    "additionalProperties": true,
    "properties": {
      "timestamp": {
        "type": "number",
        "required" : true
      }
    }
  },

  "register" : {
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
  },

  "search" : {
    "title": "search",
    "type": "object",
    "properties": {
      "timestamp": {
        "type": "integer",
        "required" : true
      }
    }
  },

  "set": {
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
  },

  "checkin": {
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
            "required": true
          }
        }
      },
      "object": {
        "type": "object",
        "required": true,
        "properties": {
          "state": {
            "type": "string",
           "required": true
          },
          "statusText": {
            "type": "string",
            "required": true
          }
        }
      }
    }
  },

  "send": {
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
            "required": true
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
          "body": {
            "type": "string",
            "required": false
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
  },

  "post" : {
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
  },

  "fetch" : {
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
  },

  "request-friend" : {
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
  },

  "remove-friend" : {
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
  },

  "make-friend" : {
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
  },

  "update": {
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
};
module.exports = schemas;
