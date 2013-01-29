var schemas = {
  "ping" : {
    "title": "ping",
    "type": "object",
    "properties": {
      "timestamp": {
        "type": "string",
        "required" : true
      }
    }
  },

  "register" : {
    "title": "register",
    "type": "object",
    "properties": {
      "object" : {
        "title": "object",
        "type": "object",
        "required": true,
        "properties" : {
          "remoteStorage": {
            "type": "object",
            "required": false,
            "properties": {
              "bearerToken": {
                "type": "string",
                "required" : true
              },
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

  "message": {
    "title": "message",
    "type": "object",
    "properties": {
      "actor": {
        "type": "object",
        "required": true,
        "properties": {
          "protocol": {
            "type": "string",
            "required": true
          },
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
      "source": {
        "type": "object",
        "required": true,
        "properties": {
          "protocol": {
            "type": "string",
            "required": true
          },
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
      "object": {
        "type": "string",
        "required" : true
      }
    }
  },
  "create" : {
    "title": "create",
    "type": "object",
    "properties": {
      "object": {
        "type": "object",
        "required" : true,
        "properties": {
          "title": {
            "type": "string",
            "required" : true
          },
          "body": {
            "type": "string",
            "required" : true
          }
        }  
      },
      "target": {
        "type": "object",
        "required" : true,
        "properties": {
          "repo": {
            "type": "string",
            "required" : true
          },
          "owner": {
            "type": "string",
            "required" : true
          }
        }  
      }
    }
  }
};
module.exports = schemas;
