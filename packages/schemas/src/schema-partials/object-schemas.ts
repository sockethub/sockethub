export const validObjectRefs = [];
export const validObjectDefs = {};

export const objectSchemas = {

  "credentials": {
    "required": [ "type" ],
    "additionalProperties": true,
    "properties": {
      "type": {
        "enum": [ "credentials" ]
      }
    }
  },

  "feed": {
    "required": [ "id", "type" ],
    "additionalProperties": true,
    "properties": {
      "type": {
        "enum": [ "feed" ]
      },
      "id": {
        "type": "string",
        "format": "iri"
      },
      "name": {
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "author": {
        "type": "string"
      },
      "favicon": {
        "type": "string"
      }
    }
  },

  "message": {
    "required": [ "type", "content" ],
    "additionalProperties": true,
    "properties": {
      "type": {
        "enum": [ "message" ]
      },
      "id": {
        "type": "string",
      },
      "name": {
        "type": "string"
      },
      "content": {
        "type": "string"
      }
    }
  },

  "me": {
    "required": ["type", "content"],
    "additionalProperties": true,
    "properties": {
      "type": {
        "enum": ["me"]
      },
      "content": {
        "type": "string"
      }
    }
  },

  "person": {
    "required": [ "id", "type" ],
    "additionalProperties": true,
    "properties": {
      "id": {
        "type": "string"
      },
      "type": {
        "enum": [ "person" ]
      },
      "name": {
        "type": "string"
      }
    }
  },

  "room": {
    "required": [ "id", "type" ],
    "additionalProperties": true,
    "properties": {
      "id": {
        "type": "string"
      },
      "type": {
        "enum": [ "room" ]
      },
      "name": {
        "type": "string"
      }
    }
  },

  "service": {
    "required": [ "id", "type" ],
    "additionalProperties": true,
    "properties": {
      "id": {
        "type": "string"
      },
      "type": {
        "enum": [ "service" ]
      },
      "name": {
        "type": "string"
      }
    }
  },

  "website": {
    "required": [ "id", "type" ],
    "additionalProperties": true,
    "properties": {
      "id": {
        "type": "string",
        "format": "iri"
      },
      "type": {
        "enum": [ "website" ]
      },
      "name": {
        "type": "string"
      }
    }
  },

  "attendance": {
    "required": [ "type" ],
    "additionalProperties": false,
    "properties": {
      "type": {
        "enum": [ "attendance" ]
      },
      "members": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    }
  },

  "presence": {
    "required": [ "type" ],
    "additionalProperties": false,
    "properties": {
      "type": {
        "enum": [ "presence" ]
      },
      "presence": {
        "enum": [ "away", "chat", "dnd", "xa", "offline", "online" ]
      },
      "role": {
        "enum": [ "owner", "member", "participant", "admin" ]
      },
      "content": {
        "type": "string"
      }
    }
  },

  // inspired by https://www.w3.org/ns/activitystreams#Relationship
  "relationship": {
    "required": [ "type", "relationship" ],
    "additionalProperties": false,
    "properties": {
      "type": {
        "enum": [ "relationship" ]
      },
      "relationship": {
        "enum": [ "role" ]
      },
      "subject": {
        "type": "object",
        "oneOf": [
          { "$ref": "#/definitions/type/presence" }
        ]
      },
      "object": {
        "type": "object",
        "oneOf": validObjectRefs,
      }
    }
  },

  "topic": {
    "required": [ "type" ],
    "additionalProperties": false,
    "properties": {
      "type": {
        "enum": [ "topic" ]
      },
      "content": {
        "type": "string"
      }
    }
  },

  "address": {
    "required": [ "type" ],
    "additionalProperties": false,
    "properties": {
      "type": {
        "enum": [ "address" ]
      }
    }
  }
};

export const objectTypes = Object.keys(objectSchemas);

objectTypes.forEach(function (type, i) {
  if (type === 'credentials') {
    return;
  }
  validObjectRefs.push({ "$ref": "#/definitions/type/" + type });
  validObjectDefs[type] = objectSchemas[type];
});
