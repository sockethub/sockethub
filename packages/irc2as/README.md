# irc2as
Parses the IRC protocol into ActivtyStreams objects.

## overview
Currently a very simple library to parse incoming IRC protocol messages and generate activity streams. The activity streams are not fully AS2.0 compliant, but aim to be shaped in the spirit of them, and as time goes on hopefully become more compliant (PRs & feedback welcome).

## usage

    var Irc2AS = require('irc2as');
    var irc2as = new Irc2AS({server: 'irc.freenode.net'});
    irc2as.events.on('stream', function (stream) {
      console.log('activity stream: ', stream);
    });

    irc2as.events.on('unprocessed', function (line) {
      console.log('irc line we don't know what to do with (yet), PRs welcome', line);
    });

    irc2as.events.on('pong', function (timestamp) {
      console.log('received pong response from server at ', timestamp);
    })

    // ....  some code to get IRC socket messages
    ircClient.on('data', this.irc2as.input.bind(this.irc2as));

## license

MIT

## maintainer
Nick Jennings <nick@silverbucket.net>
