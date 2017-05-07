# activity-streams.js

[![Greenkeeper badge](https://badges.greenkeeper.io/silverbucket/activity-streams.js.svg)](https://greenkeeper.io/)

[![Build Status](http://img.shields.io/travis/silverbucket/activity-streams.js.svg?style=flat)](http://travis-ci.org/silverbucket/activity-streams.js)
[![Code Climate](http://img.shields.io/codeclimate/github/silverbucket/activity-streams.js.svg?style=flat)](https://codeclimate.com/github/silverbucket/activity-streams.js)
[![license](https://img.shields.io/npm/l/activity-streams.svg?style=flat)](https://npmjs.org/package/activity-streams)
[![downloads](http://img.shields.io/npm/dm/activity-streams.svg?style=flat)](https://npmjs.org/package/activity-streams)
[![release](http://img.shields.io/github/release/silverbucket/activity-streams.js.svg?style=flat)](https://github.com/silverbucket/activity-streams.js/releases)

A simple tool to facilitate handling and referencing activity streams and it's objects, cutting down on verbosity.

Designed to run in both `node.js` and the `browser`.

## ALPHA

**Warning** this library is `pre-alpha` quality and considered extremely experimental, subject to change at any time.

I am learning about JSON-LD and ActivityStreams2 as I write this library, so suggestions for improvement are very welcome.


## Install

#### Node.js

`npm install activity-streams`

`var ActivityStreams = require('activity-streams')();`

#### Browser

`<script src="http://example.com/activity-streams.js"></script>`

Once included in a web-page, the `ActivityStreams` base object should be on the global scope, with the sub-properties `ActivityStreams.Object` and `ActivityStreams.Stream`.


## Example

```javascript

var AS = new ActivityStreams();

AS.Object.create({
    '@id': 'irc://exampleUser@irc.freenode.net',
    '@type': "person",
    displayName: 'Example User',
    url: "http://activitystrea.ms",
    image: {
      url: "http://activitystrea.ms/avatar.jpg",
      mediaType: "image/jpeg",
      width: 250,
      height: 250
    }
  });

AS.on('activity-object-create', function (obj) {
  console.log('this object was just created: ', obj);
  });

AS.Object.create({
    '@id': 'irc://irc.freenode.net/activitystreams',
    '@type': "chatroom",
    displayName: '#activitystreams'
  });

var exampleUser = AS.Object.get('irc://exampleUser@irc.freenode.net');
// ... returns:
//  {
//    '@id': 'irc://exampleUser@irc.freenode.net',
//    '@type': "person",
//    displayName: 'Example User',
//    url: "http://activitystrea.ms",
//    image: {
//      url: "http://activitystrea.ms/avatar.jpg",
//      mediaType: "image/jpeg",
//      width: 250,
//      height: 250
//    }
//  }

AS.Stream({
    '@context': 'send',
    actor: 'irc://exampleUser@irc.freenode.net',
    object: {
      '@type': "message",
      content: "hello world!"
    },
    target: 'irc://irc.freenode.net/activitystreams'
  });
// ... returns:
//  {
//    '@context': 'send',
//    actor: {
//      '@id': 'irc://exampleUser@irc.freenode.net',
//      '@type': "person",
//      displayName: 'Example User',
//      url: "http://activitystrea.ms",
//      image: {
//        url: "http://activitystrea.ms/avatar.jpg",
//        mediaType: "image/jpeg",
//        width: 250,
//        height: 250
//      }
//    },
//    object: {
//      '@type': "message",
//      content: "hello world!"
//    },
//    target: {
//      '@id': 'irc://irc.freenode.net/activitystreams',
//      '@type': "chatroom",
//      displayName: '#activitystreams'
//    }
//  }
