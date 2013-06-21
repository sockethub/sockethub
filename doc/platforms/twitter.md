

## examples

### posting a tweet


```javascript
  {
    rid: 123,
    platform: "twitter",
    verb: "post",
    actor: {
      address: "slvrbckt"
    },
    object: {
      text: "Hello from @sockethub! http://t.co/a4ec8vV9Sz #sockethub"
    },
    target: []
  }
```

### twitter response
```javascript
  {
    platform: "twitter",
    rid: 123,
    status: true,
    verb: "post",
    actor: {
      name: "Nick Jennings",
      address: "slvrbckt",
      id: 5909712,
      image: "https://twimg0-a.akamaihd.net/profile_images/2035392657/avatar-WEB-Picture-8_normal.jpg"
    },
    object: {
      date: "Fri Jun 21 16:03:11 +0000 2013",
      id: 348108849405911040,
      source: "<a href="http://sockethub.org" rel="nofollow">Sockethub Example App</a>",
      text: "Hello from @sockethub! http://t.co/a4ec8vV9Sz #sockethub",
      tags: ['sockethub'],
      urls: ['http://sockethub.org']
    },
    target: [
      {
        field: "mention",
        id: 1134572197,
        address: "sockethub"
      }
    ]
  }
```


*[not implemented]*

### fetching tweets

 ```javascript
  {
    platform: "twitter",
    rid: 61212,
    verb: "fetch",
    actor: {
      address: "slvrbckt",
    },
    object: {
      poll: true // continuous polling
    },
    target: [
      {
        address: "sockethub"
      }
    ]
  }
```

### receiving new tweets

 ```javascript
  {
    platform: "twitter",
    verb: "post",
    actor: {
      name: "Nick Jennings",
      address: "slvrbckt",
      id: 5909712,
      description: "freelance developer and project manager. javascript & node.js, *nix administration, web application development.",
      image: "https://twimg0-a.akamaihd.net/profile_images/2035392657/avatar-WEB-Picture-8_normal.jpg"
    },
    object: {
      date: "Fri Jun 21 16:03:11 +0000 2013",
      id: 348108849405911040,
      url: "https://t.co/z5rxwvlZ1M",
      source: "<a href="http://sockethub.org" rel="nofollow">Sockethub Example App</a>",
      text: "Hello from @sockethub! http://t.co/a4ec8vV9Sz #sockethub",
      tags: ['sockethub'],
      urls: ['http://sockethub.org']
    },
    target: [
      {
        field: "mention",
        id: 1134572197,
        address: "sockethub"
      }
    ]
  }
```