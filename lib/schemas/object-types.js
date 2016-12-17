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
    "required": [ "@id", "@type" ],
    "additionalProperties": true,
    "properties": {
      "@id": {
        "type": "string",
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
    "required": [ "@id", "@type", "displayName" ],
    "additionalProperties": true,
    "properties": {
      "@id": {
        "type": "string",
      },
      "@type": {
        "enum": [ "person" ]
      },
      "displayName": {
        "type": "string"
      }
    }
  },

  "presence": {
    "required": [ "@type", "status", "presence" ],
    "additionalProperties": true,
    "properties": {
      "@id": {
        "type": "string",
      },
      "@type": {
        "enum": [ "presence" ]
      },
      "status": {
        "type": "string"
      },
      "presence": {
        "type": "string"
      }
    }
  },


  "room": {
    "required": [ "@id", "@type", "displayName" ],
    "additionalProperties": true,
    "properties": {
      "@id": {
        "type": "string",
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
    "required": [ "@id", "@type", "displayName" ],
    "additionalProperties": true,
    "properties": {
      "@id": {
        "type": "string",
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

