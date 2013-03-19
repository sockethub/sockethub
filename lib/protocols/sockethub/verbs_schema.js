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
        "type": "object",
        "required": true,
        "properties": {
          "to": {
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
                }
              }
            }
          },
          "cc": {
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
                }
              }
            }
          },
          "bcc": {
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
                }
              }
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
      }
    },
    "target": {
      "type": "object",
      "required": true,
      "properties": {
        "to": {
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
              }
            }
          }
        },
        "cc": {
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
              }
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
      "type": "object",
      "required": true,
      "properties": {
        "to": {
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
              }
            }
          }
        }
      }
    }
  }
};
module.exports = schemas;
