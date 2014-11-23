# activity-streams.js

A simple too to facilitate handling and referencing activity streams without unecessary verbosity.

Designed to run in both `node.js` and the `browser`.

## ALPHA

**Warning** this library is `alpha` quality and considered extremely experimental, subject to change at any time.

I am learning about JSON-LD and ActivityStreams as I write this library, so suggestions for improvement are very welcome.


## Install

#### Node.js

`npm install activity-streams`

`var Activity = require('activity-streams');`

#### Browser

`<script src="http://example.com/activity-streams.js"></script>`

Once included in a web-page, the `Activity` base object should be on the global scope, with the sub-properties `Activity.Object` and `Activity.Stream`.


## Example

```javascript

Activity.Object.create({
    id: 'irc://exampleUser@irc.freenode.net',
    objectType: "person",
    displayName: 'Example User',
    url: "http://activitystrea.ms",
    image: {
      url: "http://activitystrea.ms/avatar.jpg",
      mediaType: "image/jpeg",
      width: 250,
      height: 250
    }
  });

Activity.Object.create({
    objectType: "chatroom",
    id: 'irc://irc.freenode.net/activitystreams',
    displayName: '#activitystreams'
  });

var exampleUser = Activity.Object.get('irc://exampleUser@irc.freenode.net');

Activity.Stream.create({
    verb: 'send',
    actor: 'irc://exampleUser@irc.freenode.net',
    object: {
      objectType: "message",
      text: "hello world!"
    },
    target: 'irc://irc.freenode.net/activitystreams'
  });

