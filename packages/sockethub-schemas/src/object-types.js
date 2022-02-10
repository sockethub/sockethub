const validObjectRefs = [];
const validObjectDefs = {};

const objectTypes = {

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
    "activity-object": true,
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
    "activity-object": true,
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
    "activity-object": true,
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
    "activity-object": true,
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
    "activity-object": true,
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
    "activity-object": true,
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
    "activity-object": true,
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
    "activity-object": true,
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
    "activity-object": true,
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
    "activity-object": true,
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
    "activity-object": true,
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
    "activity-object": true,
    "required": [ "type" ],
    "additionalProperties": false,
    "properties": {
      "type": {
        "enum": [ "address" ]
      }
    }
  }
};

const keys = Object.keys(objectTypes);
keys.forEach(function (type, i) {
  if (objectTypes[type]["activity-object"]) {
    validObjectRefs.push({ "$ref": "#/definitions/type/" + type });
    validObjectDefs[type] = objectTypes[type];
    delete objectTypes[type]["activity-object"];
  }
});

module.exports = {
  objectTypes,
  validObjectRefs,
  validObjectDefs
};
