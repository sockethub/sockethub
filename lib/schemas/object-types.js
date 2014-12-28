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
  }

};
