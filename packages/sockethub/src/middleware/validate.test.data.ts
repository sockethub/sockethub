export default [
  {
    "name": "mismatched types",
    "valid": false,
    "type": "credentials",
    "input":{
      "@id":"blah",
      "@type":"send",
      "context":"dummy",
      "actor":{
        "@id":"dood@irc.freenode.net",
        "@type":"person",
        "displayName":"dood"
      },
      "target":{
        "@id":"irc.freenode.net/sockethub",
        "@type":"person",
        "displayName":"sockethub"
      },
      "object":{
        "@type":"credentials",
        "user": 'foo',
        "pass": 'bar'
      }
    },
    'error': "Error: credential activity streams must have credentials set as @type"
  },
  {
    "name": "basic",
    "valid":true,
    "type":"credentials",
    "input":{
      "@id":"blah",
      "@type":"credentials",
      "context":"dummy",
      "actor":{
        "@id":"dood@irc.freenode.net",
        "@type":"person",
        "displayName":"dood"
      },
      "object":{
        '@type': 'credentials',
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
      "@type":"credentials",
      "actor":{
        "@id":"sh-9K3Vk@irc.freenode.net",
        "@type":"person",
        "displayName":"sh-9K3Vk",
        "image":{
          "height":250,
          "mediaType":"image/jpeg",
          "url":"http://example.org/image.jpg",
          "width":250
        },
        "url":"http://sockethub.org"
      },
      "object":{
        "@type":"credentials",
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
      "@type":"credentials",
      "actor":{
        "@id":"sh-9K3Vk@irc.freenode.net",
        "@type":"person",
        "displayName":"sh-9K3Vk",
        "image":{
          "height":250,
          "mediaType":"image/jpeg",
          "url":"http://example.org/image.jpg",
          "width":250
        },
        "url":"http://sockethub.org"
      },
      "object":{
        "@type":"credentials",
        "user":"sh-9K3Vk",
        "port":6667,
        "secure":false,
        "host":"irc.freenode.net"
      }
    },
    "error": "Error: credentials schema validation failed: /object = Missing required property: nick"
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
    "error": "Error: credential activity streams must have credentials set as @type"
  },
  {
    "name":"person",
    "type":"activity-object",
    "valid":true,
    "input":{
      "@id":"blah",
      "@type":"person",
      "displayName":"dood"
    },
    "output":"same"
  },
  {
    "name":"person with extras",
    "valid":true,
    "type":"activity-object",
    "input":{
      "@id":"blah",
      "@type":"person",
      "displayName":"bob",
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
      "@type":"credentials",
      "nick":"sh-9K3Vk",
      "port":6667,
      "secure":false,
      "server":"irc.freenode.net"
    },
    "error": "Error: activity-object schema validation failed: /object = Data does not match any schemas from \"oneOf\""
  },
  {
    "name":"alone credentials (as credentials)",
    "valid":false,
    "type":"credentials",
    "input":{
      "@type":"credentials",
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
      "@id":"sh-9K3Vk@irc.freenode.net",
      "@type":"person",
      "displayName":"sh-9K3Vk",
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
      "@id":"irc://sh-9K3Vk@irc.freenode.net",
      "@type":"person",
      "displayName":"sh-9K3Vk",
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
        "@id":"blah",
        "@type":"send",
        "context":"hello",
        "actor":{
          "displayName":"dood"
        },
        "target":{
          "@type":"person",
          "displayName":"bob"
        },
        "object":{
          "@type":"credentials"
        }
      },
      "noId":{
        "displayName":"dood"
      },
      "noId2":{
        "@type":"person",
        "displayName":"bob"
      },
      "noDisplayName":{
        "@id":"larg"
      }
    },
    "error": "Error: activity-object schema validation failed: /object = Data does not match any schemas from \"oneOf\""
  },
  {
    "name":"non-expected AS will fail",
    "valid":false,
    "type":"message",
    "input":{
      "actor":"irc://uuu@localhost",
      "@type":"join",
      "context":"irc",
      "target":"irc://irc.dooder.net/a-room"
    }
  }
];