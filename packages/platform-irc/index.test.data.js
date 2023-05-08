modules.exports = [
  {
    name: "irc credentials",
    valid: true,
    type: "credentials",
    input: {
      context: "irc",
      type: "credentials",
      actor: {
        id: "sh-9K3Vk@irc.freenode.net",
        type: "person",
        name: "sh-9K3Vk",
        image: {
          height: 250,
          mediaType: "image/jpeg",
          url: "http://example.org/image.jpg",
          width: 250,
        },
        url: "http://sockethub.org",
      },
      object: {
        type: "credentials",
        nick: "sh-9K3Vk",
        port: 6667,
        secure: false,
        server: "irc.freenode.net",
      },
    },
    output: "same",
  },
  {
    name: "bad irc credentials: user/nick host/server",
    valid: false,
    type: "credentials",
    input: {
      context: "irc",
      type: "credentials",
      actor: {
        id: "sh-9K3Vk@irc.freenode.net",
        type: "person",
        name: "sh-9K3Vk",
        image: {
          height: 250,
          mediaType: "image/jpeg",
          url: "http://example.org/image.jpg",
          width: 250,
        },
        url: "http://sockethub.org",
      },
      object: {
        type: "credentials",
        user: "sh-9K3Vk",
        port: 6667,
        secure: false,
        host: "irc.freenode.net",
      },
    },
    error: "Error: [irc] /object: must NOT have additional properties: host",
  },
];
