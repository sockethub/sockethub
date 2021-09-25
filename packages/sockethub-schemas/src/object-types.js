module.exports = {

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
  }
};

