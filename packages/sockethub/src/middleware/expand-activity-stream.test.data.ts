export default [
  {
    "name": "basic invalid type",
    "valid":true,
    "type":"credentials",
    "input":{
      "@id":"foo",
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
        "@type":"credentials"
      }
    },
    "output": "same"
  },
  {
    "name": "basic valid type",
    "valid":true,
    "type":"credentials",
    "input":{
      "@id":"foo",
      "@type":"credentials",
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
        "@type":"credentials"
      }
    },
    "output":"same"
  },
  {
    "name":"new format",
    "valid":true,
    "type":"credentials",
    "input":{
      "@type":"credentials",
      "context":"irc",
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
    "error": "Error: activity stream must contain a @type property."
  },
  {
    "name": "expand unknown actor",
    "type": "message",
    "valid": "true",
    "input": {
      "context": "foo",
      "@type": "bar",
      "actor": "foo@bar",
      "object": {
        "content": "bar"
      }
    },
    "output": {
      "context": "foo",
      "@type": "bar",
      "actor": {
        "@id": "foo@bar"
      },
      "object": {
        "content": "bar"
      }
    }
  },
  {
    "name": "expand unknown actor 2",
    "type": "message",
    "valid": "true",
    "input": {
      "context": "foo",
      "@type": "bar",
      "actor": "someone@example.org/resource",
      "object": {
        "content": "bar"
      }
    },
    "output": {
      "context": "foo",
      "@type": "bar",
      "actor": {
        "@id": "someone@example.org/resource"
      },
      "object": {
        "content": "bar"
      }
    }
  },
  {
    "name": "expand unknown actor 2",
    "type": "message",
    "valid": "true",
    "input": {
      "context": "foo",
      "@type": "bar",
      "actor": "xmpp:someone@example.org/resource",
      "object": {
        "content": "bar"
      }
    },
    "output": {
      "context": "foo",
      "@type": "bar",
      "actor": {
        "@id": "xmpp:someone@example.org/resource"
      },
      "object": {
        "content": "bar"
      }
    }
  },
  {
    "name":"person",
    "type":"message",
    "valid":true,
    "input":{
      "context": "some context",
      "@type": "some type",
      "actor": "blah",
      "object": {}
    },
    "output": {
      "context": "some context",
      "@type": "some type",
      "actor": {
        "@id":"blah",
        "@type":"person",
        "displayName":"dood"
      },
      "object": {}
    }
  },
  {
    "name":"person with extras",
    "valid":true,
    "type":"message",
    "input": {
      "context": "some context",
      "@type": "some type",
      "actor": "blah2",
      "object": {}
    },
    "output": {
      "context": "some context",
      "@type": "some type",
      "actor": {
        "@id":"blah2",
        "@type":"person",
        "displayName":"bob",
        "hello":"there",
        "i":[
          "am",
          "extras"
        ]
      },
      "object": {}
    }
  },
  {
    "name":"bad parent object",
    "valid":false,
    "type":"message",
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
    "error": "Error: activity stream must contain a context property"
  },
  {
    "name":"no actor specified",
    "valid":false,
    "type":"message",
    "input":{
      "@type": "some type",
      "context":"xmpp",
      "object":{
        "@type": "error",
        "content": "error message"
      }
    },
    "error": "Error: activity stream must contain an actor property."
  },
  {
    "name":"expand actor and target of unknowns",
    "valid":true,
    "type":"message",
    "input":{
      "actor":"irc://uuu@localhost",
      "@type":"join",
      "context":"irc",
      "target":"irc://irc.dooder.net/a-room"
    },
    "output":{
      "actor":{
        "@id":"irc://uuu@localhost"
      },
      "@type":"join",
      "context":"irc",
      "target":{
        "@id":"irc://irc.dooder.net/a-room"
      }
    }
  },
  {
    "name":"expand actor and target of unknowns",
    "valid":true,
    "type":"message",
    "input":{
      "actor":"hyper_rau@localhost",
      "@type":"join",
      "context":"xmpp",
      "object":{

      },
      "target":"dooder"
    },
    "output":{
      "actor":{
        "@id":"hyper_rau@localhost"
      },
      "@type":"join",
      "context":"xmpp",
      "object":{

      },
      "target":{
        "@id":"dooder"
      }
    }
  },
  {
    "name":"expand known person",
    "valid":true,
    "type":"message",
    "input":{
      "actor":"sh-9K3Vk@irc.freenode.net",
      "target":"blah3",
      "@type":"send",
      "context":"irc",
      "object":{

      }
    },
    "output":{
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
      "target":{
        "@id":"blah3",
        "@type":"person",
        "displayName":"bob",
        "hello":"there",
        "i":[
          "am",
          "extras"
        ]
      },
      "@type":"send",
      "context":"irc",
      "object":{

      }
    }
  }
];