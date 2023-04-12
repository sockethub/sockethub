# IRC2AS

Parses the IRC protocol into ActivtyStreams objects.

## Overview

Currently a very simple library to parse incoming IRC protocol messages and generate activity
streams. The activity streams are not fully AS2.0 compliant, but aim to be shaped in the spirit
of them, and as time goes on hopefully become more compliant (PRs & feedback welcome).

## Usage

```javascript
    var IRC2AS = require('irc2as');
    var irc2as = new IRC2AS({server: 'irc.freenode.net'});

    irc2as.events.on('incoming', function (asObject) {
      console.log('activity stream: ', asObject);
    });

    irc2as.events.on('error', function (asObject) {
      console.log('error response to something we sent: ', asObject);
    });

    irc2as.events.on('unprocessed', function (line) {
      console.log(`irc line we don't know what to do with (yet), PRs welcome`, line);
    });

    irc2as.events.on('pong', function (timestamp) {
      console.log('confirmation of something we sent: ', timestamp);
    });

    irc2as.events.on('ping', function (timestamp) {
      console.log('sending ping to server at ', timestamp);
    });

    // ....  some code to get IRC socket messages
    ircClient.on('data', this.irc2as.input.bind(this.irc2as));
```

## License

MIT

## Maintainer

Nick Jennings <nick@silverbucket.net>
