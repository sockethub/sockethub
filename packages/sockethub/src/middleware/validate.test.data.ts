export default [
  {
    "name": "mismatched types",
    "valid": false,
    "type": "credentials",
    "input":{
      "id":"blah",
      "type":"send",
      "context":"dummy",
      "actor":{
        "id":"dood@irc.freenode.net",
        "type":"person",
        "name":"dood"
      },
      "target":{
        "id":"irc.freenode.net/sockethub",
        "type":"person",
        "name":"sockethub"
      },
      "object":{
        "type":"credentials",
        "user": 'foo',
        "pass": 'bar'
      }
    },
    'error': "Error: credential activity streams must have credentials set as type"
  },
  {
    "name": "basic",
    "valid":true,
    "type":"credentials",
    "input":{
      "id":"blah",
      "type":"credentials",
      "context":"dummy",
      "actor":{
        "id":"dood@irc.freenode.net",
        "type":"person",
        "name":"dood"
      },
      "object":{
        'type': 'credentials',
        "user": 'foo',
        "pass": 'bar'
      }
    },
    "output":"same"
  },
  {
    "name":"irc credentials",
    "valid":true,
    "type":"credentials",
    "input":{
      "context":"irc",
      "type":"credentials",
      "actor":{
        "id":"sh-9K3Vk@irc.freenode.net",
        "type":"person",
        "name":"sh-9K3Vk",
        "image":{
          "height":250,
          "mediaType":"image/jpeg",
          "url":"http://example.org/image.jpg",
          "width":250
        },
        "url":"http://sockethub.org"
      },
      "object":{
        "type":"credentials",
        "nick":"sh-9K3Vk",
        "port":6667,
        "secure":false,
        "server":"irc.freenode.net"
      }
    },
    "output":"same"
  },
  {
    "name":"bad irc credentials: user/nick host/server",
    "valid":false,
    "type":"credentials",
    "input":{
      "context":"irc",
      "type":"credentials",
      "actor":{
        "id":"sh-9K3Vk@irc.freenode.net",
        "type":"person",
        "name":"sh-9K3Vk",
        "image":{
          "height":250,
          "mediaType":"image/jpeg",
          "url":"http://example.org/image.jpg",
          "width":250
        },
        "url":"http://sockethub.org"
      },
      "object":{
        "type":"credentials",
        "user":"sh-9K3Vk",
        "port":6667,
        "secure":false,
        "host":"irc.freenode.net"
      }
    },
    "error":
      "Error: credentials schema validation failed: must have required property \'nick\'"
  },
  {
    "name":"no type specified",
    "valid":false,
    "type":"credentials",
    "input":{
      "actor":"hyper_rau@localhost",
      "context":"xmpp",
      "object":{
        "username":"hyper_rau",
        "password":"123",
        "server":"localhost",
        "port":5222,
        "resource":"laptop"
      }
    },
    "error": "Error: credential activity streams must have credentials set as type"
  },
  {
    "name":"person",
    "type":"activity-object",
    "valid":true,
    "input":{
      "id":"blah",
      "type":"person",
      "name":"dood"
    },
    "output":"same"
  },
  {
    "name":"person with extras",
    "valid":true,
    "type":"activity-object",
    "input":{
      "id":"blah",
      "type":"person",
      "name":"bob",
      "hello":"there",
      "i":[
        "am",
        "extras"
      ]
    },
    "output":"same"
  },
  {
    "name":"alone credentials (as activity-object)",
    "valid":false,
    "type":"activity-object",
    "input":{
      "type":"credentials",
      "nick":"sh-9K3Vk",
      "port":6667,
      "secure":false,
      "server":"irc.freenode.net"
    },
    "error":
      "Error: activity-object schema validation failed: must have required property \'id\'"
  },
  {
    "name":"alone credentials (as credentials)",
    "valid":false,
    "type":"credentials",
    "input":{
      "type":"credentials",
      "nick":"sh-9K3Vk",
      "port":6667,
      "secure":false,
      "server":"irc.freenode.net"
    },
    "error": "Error: platform context undefined not registered with this sockethub instance."
  },
  {
    "name":"new person",
    "valid":true,
    "type":"activity-object",
    "input":{
      "id":"sh-9K3Vk@irc.freenode.net",
      "type":"person",
      "name":"sh-9K3Vk",
      "image":{
        "height":250,
        "mediaType":"image/jpeg",
        "url":"http://example.org/image.jpg",
        "width":250
      },
      "url":"http://sockethub.org"
    },
    "output":"same"
  },
  {
    "name":"new person",
    "valid":true,
    "type":"activity-object",
    "input":{
      "id":"irc://sh-9K3Vk@irc.freenode.net",
      "type":"person",
      "name":"sh-9K3Vk",
      "url":"http://sockethub.org"
    },
    "output":"same"
  },
  {
    "name":"bad parent object",
    "valid":false,
    "type":"activity-object",
    "input":{
      "string":"this is a string",
      "array":[
        "this",
        "is",
        {
          "an":"array"
        }
      ],
      "as":{
        "id":"blah",
        "type":"send",
        "context":"hello",
        "actor":{
          "name":"dood"
        },
        "target":{
          "type":"person",
          "name":"bob"
        },
        "object":{
          "type":"credentials"
        }
      },
      "noId":{
        "name":"dood"
      },
      "noId2":{
        "type":"person",
        "name":"bob"
      },
      "noDisplayName":{
        "id":"larg"
      }
    },
    "error":
      "Error: activity-object schema validation failed: must have required property 'id'"
  },
  {
    "name":"non-expected AS will fail",
    "valid":false,
    "type":"message",
    "input":{
      "actor":"irc://uuu@localhost",
      "type":"join",
      "context":"irc",
      "target":"irc://irc.dooder.net/a-room"
    }
  },
  {
    "name":"missing type property",
    "valid":false,
    "type":"message",
    "input":{
      "actor": { "id": "irc://uuu@localhost", "type": "person" },
      "context":"irc",
      "target": { "id": "irc://irc.dooder.net/a-room", "type": "room" }
    },
    "error": "Error: actvity-stream schema validation failed: " +
      "must have required property \'type\'"
  },
  {
    "name":"invalid context property",
    "valid":false,
    "type":"message",
    "input":{
      "actor": { "id": "irc://uuu@localhost", "type": "person" },
      "type":"foo",
      "context": "foobar",
      "target": { "id": "irc://irc.dooder.net/a-room", "type": "room" }
    },
    "error": "Error: platform context foobar not registered with this sockethub instance."
  },
  {
    "name":"missing actor property",
    "valid":false,
    "type":"message",
    "input":{
      "type": "foo",
      "context":"irc",
      "target": { "id": "irc://irc.dooder.net/a-room", "type": "room" }
    },
    "error": "Error: actvity-stream schema validation failed: " +
      "must have required property \'actor\'"
  },
  {
    "name":"traditional message",
    "valid":true,
    "type":"message",
    "input":{
      "type": "foo",
      "context": "irc",
      "actor": { "id": "irc://uuu@localhost", "type": "person" }
    }
  }
];