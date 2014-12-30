module.exports = {

  "credentials": {
    "required": [ "objectType" ],
    "additionalProperties": true,
    "properties": {
      "objectType": {
        "enum": [ "credentials" ]
      }
    }
  },

  "feed": {
    "required": [ "id", "objectType" ],
    "additionalProperties": true,
    "properties": {
      "id": {
        "type": "string",
      },
      "objectType": {
        "enum": [ "feed" ]
      },
      "displayName": {
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
    "required": [ "objectType", "displayName", "content" ],
    "additionalProperties": true,
    "properties": {
      "id": {
        "type": "string",
      },
      "objectType": {
        "enum": [ "message" ]
      },
      "displayName": {
        "type": "string"
      },
      "content": {
        "type": "string"
      }
    }
  },

  "person": {
    "required": [ "id", "objectType", "displayName" ],
    "additionalProperties": true,
    "properties": {
      "id": {
        "type": "string",
      },
      "objectType": {
        "enum": [ "person" ]
      },
      "displayName": {
        "type": "string"
      }
    }
  },

  "room": {
    "required": [ "id", "objectType", "displayName" ],
    "additionalProperties": true,
    "properties": {
      "id": {
        "type": "string",
      },
      "objectType": {
        "enum": [ "room" ]
      },
      "displayName": {
        "type": "string"
      }
    }
  },

  "website": {
    "required": [ "id", "objectType", "displayName" ],
    "additionalProperties": true,
    "properties": {
      "id": {
        "type": "string",
      },
      "objectType": {
        "enum": [ "website" ]
      },
      "displayName": {
        "type": "string"
      }
    }
  }

};

