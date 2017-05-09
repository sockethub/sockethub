module.exports = {

  "credentials": {
    "required": [ "@type" ],
    "additionalProperties": true,
    "properties": {
      "@type": {
        "enum": [ "credentials" ]
      }
    }
  },

  "feed": {
    "activity-object": true,
    "required": [ "@id", "@type" ],
    "additionalProperties": true,
    "properties": {
      "@id": {
        "type": "string",
        "format": "uri"
      },
      "@type": {
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
    "required": [ "@type", "displayName", "content" ],
    "additionalProperties": true,
    "properties": {
      "@id": {
        "type": "string",
      },
      "@type": {
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
    "activity-object": true,
    "required": [ "@id", "@type", "displayName" ],
    "additionalProperties": true,
    "properties": {
      "@id": {
        "type": "string",
        "format": "uri"
      },
      "@type": {
        "enum": [ "person" ]
      },
      "displayName": {
        "type": "string"
      }
    }
  },

  "room": {
    "activity-object": true,
    "required": [ "@id", "@type", "displayName" ],
    "additionalProperties": true,
    "properties": {
      "@id": {
        "type": "string",
        "format": "uri"
      },
      "@type": {
        "enum": [ "room" ]
      },
      "displayName": {
        "type": "string"
      }
    }
  },

  "website": {
    "activity-object": true,
    "required": [ "@id", "@type", "displayName" ],
    "additionalProperties": true,
    "properties": {
      "@id": {
        "type": "string",
        "format": "uri"
      },
      "@type": {
        "enum": [ "website" ]
      },
      "displayName": {
        "type": "string"
      }
    }
  }

};

