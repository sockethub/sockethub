[![Sockethub](http://sockethub.org/res/img/sockethub-logo.svg)](http://sockethub.org)

A protocol gateway for the web.

## About
Sockethub is a translation layer for web applications to communicate with other protocols and services that are traditionally either inaccessible or impractical to use from in-browser JavaScript.

Using [ActivityStream](http://activitystrea.ms/) (AS) objects to pass messages to and from the web app, Sockethub acts as a smart proxy server/agent, which can maintain state, and connect to sockets, endpoints and networks that would otherwise be restricted from an application running in the browser.

Originally inspired as a sister project to [RemoteStorage](https://remotestorage.io), and assisting in the development of [unhosted](http://unhosted.org) and [noBackend](http://nobackend.org) applications, Sockethub's functionality can also fit into a more traditional development stack, removing the need for custom code to handle various protocol specifics at the application layer.

Example uses of Sockethub are:

* Writing and receiving messages (SMTP, IMAP, Facebook, Twitter, ...)
* Instant messaging (XMPP, IRC, MSN, FB Messenger, Hangouts, ...)
* Discovery (WebFinger, RDF(a), ...)

The architecture of Sockethub is extensible and supports easy implementation of additional 'platforms' to carry out tasks.

## Docs

See the [Sockethub wiki](https://github.com/sockethub/sockethub/wiki) for documentation.

## Features

We use ActivityStreams to map the various actions of a platform to a set of AS '@type's which identify the underlying action. For example, using the XMPP platform, a friend request/accept cycle would use the activity stream types 'request-friend', 'remove-friend', 'make-friend'.

Below is a list of platform contexts we're currently working on and their types, both the completed and not yet implemented ones. They are all implemented in Sockethub platforms (each in their own repository) and can be enabled/disabled in the `config.json`.

## Platforms

* [Feeds](../sockethub-platform-feeds) *(RSS, Atom)*
* [IRC](../sockethub-platform-irc) 
* [XMPP](../sockethub-platform-xmpp) 

## Install

`$ npm install -g sockethub`

## Running

### Environment Variables

* PORT
Defaults to `10550`
* HOST
Defaults to `localhost`
* DEBUG
Specify the namespace to console log, ie. `sockethub*` will print all sockethub related debug statements, whereas `*` will also print any other modules debug statements that use the `debug` module.

* REDIS_PORT
Defaults to `6379`
* REDIS_HOST
Defaults to `localhost`

***OR***

* REDIS_URL
Overrides `REDIS_HOST` and `REDIS_PORT`, can specify a full redis connect URL (eq. `redis://username:password@host:port`)

### Command-line params

```
  --help       : this help screen
  --info       : displays some basic runtime info

  --examples   : enabled examples page and serves helper files like jquery

  --host       : hostname to bind to
  --port       : port to bind to
```

### Start

Run with debug output and examples enabled:

`$ DEBUG=sockethub* sockethub --examples`

You should then be able to browse to `http://localhost:10550/examples` and try out the examples.

For production, with examples disabled.

`$ DEBUG=sockethub* sockethub`

## License

Sockethub is licensed under the [LGPL](https://github.com/sockethub/sockethub/blob/master/LICENSE)

## Credits

Project created and maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/res/img/nlnet-logo.svg)](http://nlnet.nl)

