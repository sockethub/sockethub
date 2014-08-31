var schema = {
  "additionalProperties": false,
  "properties": {
    "credentials" : {
      "name": "credentials",
      "type": "object",
      "required": false,
      "patternProperties" : {
        ".+": {
          "type": "object",
          "required": true,
          "additionalProperties": false,
          "properties": {
            "consumer_key" : {
              "name" : "consumer_key",
              "required" : true,
              "type": "string"
            },
            "consumer_secret" : {
              "name" : "consumer_secret",
              "required" : true,
              "type": "string"
            },
            "access_token" : {
              "name" : "access_token",
              "required" : true,
              "type": "string"
            },
            "access_token_secret" : {
              "name" : "access_token_secret",
              "required" : true,
              "type": "string"
            }
          }
        }
      }
    }
  }
};

var obj = {
  credentials: {
    jdoe: {
      consumer_key : 'sfsdfds',
      consumer_secret : 'sdfsdfs',
      access_token : 'sdfsdf',
      access_token_secret : 'sdfsdfsd'
    }
  }
};
var json_obj = JSON.stringify(obj);

console.log("\n--");
var tv4 = require('tv4');
if (tv4.validate(obj, schema)) {  // protocol.js json errors
  console.log(' job.object schema validated ');//, report);
} else {
  console.log(' invalid object format '+tv4.error.message);
}


console.log("\n--");
var obj = {
  platform: 'dispatcher',
  verb: 'register',
  object: {},//'sadsadasd',//{ secret: '1234567890' },
  rid: 2
};

var schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    object: {
      type: 'object',
      required: true,
      properties: {}
    }
  }
};


var tv4 = require('tv4');
if (tv4.validate(obj, schema)) {  // protocol.js json errors
  console.log(' job.object schema validated ');//, report);
} else {
  console.log(' invalid object format '+tv4.error.message);
}

console.log("\n");