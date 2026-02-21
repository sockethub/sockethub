# @sockethub/activity-streams

[![License](https://img.shields.io/npm/l/activity-streams.svg?style=flat)](https://npmjs.org/package/@sockethub/activity-streams)
[![Downloads](http://img.shields.io/npm/dm/activity-streams.svg?style=flat)](https://npmjs.org/package/@sockethub/activity-streams)

A simple tool to facilitate handling and referencing activity streams and its objects, cutting
down on verbosity.

Designed to run in both `node.js`, `bun` and the `browser`.

This is a WIP and not fully JSON-LD or ActivityStreams2 compliant, suggestions for improvement
are very welcome.

## What it does

This library helps you:

- **Create and store** ActivityStream objects with validation
- **Auto-expand** string references into full objects (e.g., `"user@example.com"` becomes `{id: "user@example.com"}`)
- **Build Activity Streams** that automatically link to stored objects
- **Listen for events** when objects are created or deleted

It does not rename legacy aliases like `verb`, `objectType`, `@id`, or `@type`.
Use canonical fields directly (`type`, `id`, and `@context`).

## Install

### Node.js

`$ npm install @sockethub/activity-streams`

### Bun

`$ bun install @sockethub/activity-streams`

#### CommonJS

```javascript
const ASFactory = require('@sockethub/activity-streams');
const ActivityStreams = ASFactory({
  failOnUnknownObjectProperties: false // default
});
```

#### ESM

```javascript
import { ASFactory } from '@sockethub/activity-streams';
const ActivityStreams = ASFactory({
  failOnUnknownObjectProperties: false // default
});
```

### Browser

The browser bundle is available in the dist folder:

```javascript
import '@sockethub/activity-streams/dist/activity-streams.js';
```

You can place it somewhere accessible from the web and include it via a `script` tag.

```javascript
<script src="http://example.com/activity-streams.js" type="module"></script>
```

Once included in a web-page, the `ActivityStreams` base object should be on the global scope, with
the sub-properties `ActivityStreams.Object` and `ActivityStreams.Stream`.

## Quick Start

### Standalone Usage

```javascript
import { ASFactory } from '@sockethub/activity-streams';
const ActivityStreams = ASFactory();

// Create an object
const user = ActivityStreams.Object.create({
  id: "user@example.com",
  type: "person",
  name: "John Doe"
});

// Create an activity that references it
const activity = ActivityStreams.Stream({
  type: "send",
  context: "irc",
  actor: "user@example.com",  // automatically expands to full object
  object: { type: "message", content: "Hello!" }
});
```

### With Sockethub Client

If you're using the Sockethub client, this library is already bundled and available:

```javascript
import SockethubClient from '@sockethub/client';

const socket = io('http://localhost:10550');
const sockethubClient = new SockethubClient(socket);

// Access ActivityStreams through the client
const user = sockethubClient.ActivityStreams.Object.create({
  id: "user@example.com", 
  type: "person",
  name: "John Doe"
});

const activity = sockethubClient.ActivityStreams.Stream({
  type: "send",
  context: "irc",
  actor: "user@example.com",
  object: { type: "message", content: "Hello!" }
});
```

## Example

```javascript

const ActivityStreams = ASFactory();

ActivityStreams.Object.create({
  id: 'irc://exampleUser@irc.freenode.net',
  type: "person",
  name: 'Example User',
  url: "http://activitystrea.ms",
  image: {
    url: "http://activitystrea.ms/avatar.jpg",
    mediaType: "image/jpeg",
    width: 250,
    height: 250
  }
});

ActivityStreams.on('activity-object-create', function (obj) {
  console.log('this object was just created: ', obj);
});

ActivityStreams.Object.create({
  id: 'irc://irc.freenode.net/activitystreams',
  type: "chatroom",
  name: '#activitystreams'
});

const exampleUser = ActivityStreams.Object.get('irc://exampleUser@irc.freenode.net');
    // ... returns:
    //  {
    //    id: 'irc://exampleUser@irc.freenode.net',
    //    type: "person",
    //    name: 'Example User',
    //    url: "http://activitystrea.ms",
    //    image: {
    //      url: "http://activitystrea.ms/avatar.jpg",
    //      mediaType: "image/jpeg",
    //      width: 250,
    //      height: 250
    //    }
    //  }

ActivityStreams.Stream({
  type: 'send',
  actor: 'irc://exampleUser@irc.freenode.net',
  object: {
    type: "message",
    content: "hello world!"
  },
  target: 'irc://irc.freenode.net/activitystreams'
});
    // ... returns:
    //  {
    //    type: 'send',
    //    actor: {
    //      id: 'irc://exampleUser@irc.freenode.net',
    //      type: "person",
    //      name: 'Example User',
    //      url: "http://activitystrea.ms",
    //      image: {
    //        url: "http://activitystrea.ms/avatar.jpg",
    //        mediaType: "image/jpeg",
    //        width: 250,
    //        height: 250
    //      }
    //    },
    //    object: {
    //      type: "message",
    //      content: "hello world!"
    //    },
    //    target: {
    //      id: 'irc://irc.freenode.net/activitystreams',
    //      type: "chatroom",
    //      name: '#activitystreams'
    //    }
    //  }
```

## Error Handling

The library provides clear error messages when validation fails:

```javascript
// This will throw: "ActivityStreams validation failed: the 'object' property is null"
ActivityStreams.Object.create(null);

// This will throw: "ActivityStreams validation failed: the 'object' property received string..."
ActivityStreams.Object.create("just-a-string");

// This will throw: "ActivityStreams validation failed: property 'foo' with value 'bar' is not allowed..."
ActivityStreams.Object.create({ id: "test", foo: "bar" });
```
