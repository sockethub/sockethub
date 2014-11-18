CHANGELOG
=========

sockethub v0.3.2 - 18.11.2014
-----------------------------

- refactored SessionManager and ClientManager to use `array-keys` package for tracking session and client objects.

- platform irc: now supports specifying any port and the use of non-secure connections. updated irc example as well.


sockethub v0.3.1 - 16.11.2014
-----------------------------

- bugfix: regression fixed where client sessions were not being destroyed due to being lost in an idex.

- platform irc: allow port and secure(true/false) to be specified by the client. defaults to secure, and port 6697.


sockethub v0.3.0 - 16.11.2014
-----------------------------

- platform irc: fix during connect, the USER command would be rejected due to not enough params.

- platform irc: remove `:` from message string, no longer used in irc-factory library.

- docker: working docker file! hooray!

- updated npm dependencies.


sockethub v0.2.2 - 16.10.2014
-----------------------------

- platform irc: sometimes leaving a room was represented as a join, and quits would contain undefined properties in the resulting object. ([issue #178](https://github.com/sockethub/sockethub/issues/178))


sockethub v0.2.1 - 16.10.2014
-----------------------------

- platform facebook: API errors sending back HTML when expecting JSON. ([issue #177](https://github.com/sockethub/sockethub/issues/177))


sockethub v0.2.0 - 09.09.2014
-----------------------------

- official IRC support

- improved API documentation

- revamped and simplified credentials process. breaks compatibility with 0.1.x branch. 

- refactored session module into three separate files. `lib/sockethub/session-manager.js` (the only external interface), and it's subclasses `lib/sockethub/session/session.js` and `lib/sockethub/session/platform.js`

- revamped the `set` process to use the platform name as the way to indicate where the credentials apply to. You no longer need to use the `dispatcher` platform to set credentials. ([issue #173](https://github.com/sockethub/sockethub/issues/173))

- minor improvements to class structure throughout the code, to improve readability.

- many performance optimizations.


sockethub v0.1.5 - 16.12.2013
-----------------------------

- bugfix: encryption key being lost after multiple sessions active. ([issue #141](https://github.com/sockethub/sockethub/issues/141))

- util.redis now has specific support for hset and hget. ([issue #140](https://github.com/sockethub/sockethub/issues/140))

- refactor `session.request()` function for clarity. This function issues remoteStorage GETs. [issue #139](https://github.com/sockethub/sockethub/issues/139))

- ClientManager has new method `move` which moves a client object from one key lookup to another while preserving it's reference count. ([lib/sockethub/client-manager.js](https://github.com/sockethub/sockethub/blob/master/lib/sockethub/client-manager.js))

- platform irc: change nick name. ([issue #144](https://github.com/sockethub/sockethub/issues/144))

- platform irc: several additions announcing room activity.


sockethub v0.1.4 - 03.12.2013
-----------------------------

- bugfix: race condition were a disconnect could loose it's redis connection reference before it was able to disconnect. this was fixed but ensuring the websocket server had a unique disconnect callback for each connection. ([issue #133](https://github.com/sockethub/sockethub/issues/133))

- platform rss: renamed to 'feeds' *be sure to update your config.js*

- platform feeds: added functionality to fetch only a subset of entries in a feed, using date or url and 'before' or 'after'. ([issue #136](https://github.com/sockethub/sockethub/issues/136))

- platform feeds: media property now added to object, to enable clients to use attached media like podcasts. ([issue #138](https://github.com/sockethub/sockethub/issues/138))

- ([sockethub examples](http://silverbucket.net/sockethub/examples)) updated to angular 1.2 and bootstrap 3


sockethub v0.1.3 - 08.11.2013
-----------------------------

- bugfix: subsystem event listeners were not being removed after a platform session was destroyed (memory leak)

- bugfix: in some cases jobs with non-existant platform names were accepted for processing and obviously never reply. ([commit 74587a38d23cde0078b46ab275541488b4f4bf29](https://github.com/sockethub/sockethub/commit/74587a38d23cde0078b46ab275541488b4f4bf29))

- switched to `Q` promise library due to issues with `promising`, and the added bonus of the `.fail()` method.

- many of improvements to error handling.

- removed some overly verbose logging.

- platforms: (email) ensure email platform always returns a result ([issue #131](https://github.com/sockethub/sockethub/issues/131))

- platforms: (email) more work has been done on imap functionality. ([pull #132](https://github.com/sockethub/sockethub/pull/132))

- platforms: (xmpp) explicity log out of an xmpp session after the client manager has determined the connection is no longer being used. ([#69](https://github.com/sockethub/sockethub/issues/69))


sockethub v0.1.2 - 21.10.2013
-----------------------------

- sockethub now functions correctly as a globally installed npm packaged. (`npm install -g sockethub`)

- added extensive command-line parameter support. (`bin/sockethub --help`)

- sockethub now supports logging to file.

- tests no longer depend on a config.js to be present, then can send in their own config objects on the fly.

- fixes to the removal/re-issuing of listeners.

- more work and bugfixes around client-manager.

- platforms: (irc) new `irc` platform added with initial working support. (with plans to make it more complete on next release)


sockethub v0.1.1 - 01.10.2013
-----------------------------

- major improvement of the xmpp platform, which is still a work in progress but basically use-able for sending and receiving messages with existing contacts. ([lib/platforms/xmpp.js](https://github.com/sockethub/sockethub/blob/master/lib/platforms/xmpp.js))

- introduction of a way for platforms to persist an object beyond a single session, with `session.clientManager`. ([lib/sockethub/client-manager.js](https://github.com/sockethub/sockethub/blob/master/lib/sockethub/client-manager.js))

- re-factored session objects to provide better code documentation and clarify the different roles. ([lib/sockethub/session.js](https://github.com/sockethub/sockethub/blob/master/lib/sockethub/session.js))

- by default, debug logging is now switched off, so the console output should be a bit less overwhelming.

- some fixes regarding catching uncaughtExceptions and conflicts with the promising library. ([issue #125](https://github.com/sockethub/sockethub/issues/125))

- general performance optimizations, code simplification, commenting and documentation.


sockethub v0.1.0 - 16.09.2013
------------------------------

- greatly improved documentation. ([docs](https://github.com/sockethub/sockethub/blob/master/doc/getting_started.md))

- centralized credential data structure definitions. ([commit](https://github.com/sockethub/sockethub/commit/bccde92fde2a3a6db0c3885278091be90f27331f))

- when handling an invalid redis object from the queue, don't throw an exception, just log the error and continue. ([issue #120](https://github.com/sockethub/sockethub/issues/120))

- platforms: (rss) added some more information (total count and article links) in completion response.

- updated some unit tests


sockethub v0.0.11 - 29.08.2013
------------------------------

- improved schema checks against incoming credential data objects. ([issue #109](https://github.com/sockethub/sockethub/issues/109))

- created [master list of credential data](http://github.com/sockethub/sockethub/blob/master/examples/credential-config.js) exampls, which is used both for the automated platform tests suite, and the example applications. (issues [#107](https://github.com/sockethub/sockethub/issues/107) and ([#108](https://github.com/sockethub/sockethub/issues/108))

- resolved an issue were some lingering redis connections were building up. ([issue #105](https://github.com/sockethub/sockethub/issues/105))

- much more documentation added, and updated requirements / dependencies.

- platforms: (rss) can handle fetching multiple feeds specified in one command. (issues [#111](https://github.com/sockethub/sockethub/issues/111) and ([issue #112](https://github.com/sockethub/sockethub/issues/112))

- platforms: (facebook) bugfixes ([issue #105](https://github.com/sockethub/sockethub/issues/105))

**[a complete list of closed issues assigned to this release](https://github.com/sockethub/sockethub/issues?milestone=9&page=1&state=closed)**


sockethub v0.0.10 - 31.07.2013
------------------------------

- the dispatcher verifies the platforms of incoming commands against a list of platforms that the dispatcher has received pings from during initialization, otherwise the command fails. ([issue #45](https://github.com/sockethub/sockethub/issues/45))

- revisiting the redis error, this time a few uses of the redis client were tracked down in the session object and fixed. ([issue #84](https://github.com/sockethub/sockethub/issues/84))

- dispatcher was sending cleanup to subsystem (and therefore quitting the subsystem redis channel) at the wrong point (during session end instead of during shutdown). ([issue #96](https://github.com/sockethub/sockethub/issues/96))

- when a listener is spawned (or re-spawned) it now waits until it receives the encryption key from the dispatcher before it queues for a job. ([issue #97](https://github.com/sockethub/sockethub/issues/97))

- platforms: (rss) feed data not passed to client encoded as UTF-8 ([issue #99](https://github.com/sockethub/sockethub/issues/99))

- platforms: (rss) job is now completed only after all articles are fetched and sent to client.  ([issue #98](https://github.com/sockethub/sockethub/issues/98))


sockethub v0.0.9 - 26.07.2013
-----------------------------

- simplified promise fulfillment for platforms ([issue #82](https://github.com/sockethub/sockethub/issues/82))

- improved session cleanup handling

- address some listener promise handling issues

- some small stability fixes related to redis connection hiccups


sockethub v0.0.8 - 19.07.2013
-----------------------------

- fixed some error handling in twitter platform. ([issue #89](https://github.com/sockethub/sockethub/issues/89))

- reworked redis connection management, implemented connection pool. ([issues #84](https://github.com/sockethub/sockethub/issues/84) & [#74](https://github.com/sockethub/sockethub/issues/74))

- handle SIGINT as early as possible.

- fixed race condition where a command sent immediately upon connect could be lost. ([issue #90](https://github.com/sockethub/sockethub/issues/90))

- greatly improved session cleanup handling, removed some old cruft. ([issue #92](https://github.com/sockethub/sockethub/issues/92))

- added a 'cleanup' listener for listeners to register with session objects to
  know when the dispatcher has sent out a cleanup. ([issue #92](https://github.com/sockethub/sockethub/issues/92))

- many small bugfixes


sockethub v0.0.7 - 10.07.2013
-----------------------------

- multithreading refactor, to improve decoupling and communication between dispatcher and listener(s), as well as improved stability and respawning worker threads

- bugfixes in twitter platform

- addition of imap supoprt to fetch verb in the email platform

- NOTE: npm test may fail as one of its dependencies (test) requires v0.0.18 which is unable to publish to npm at the moment, hopefully this is resolved soon.


sockethub v0.0.6 - 28.06.2013
-----------------------------

- simplified `lib/schemas/platforms.js` and verbs.js for less typing when adding new verbs or platforms (no name property required and verbs list is an array of strings).

- sockethub admins can now add custom platforms or verbs by creating a 'local' schema in `libs/schemas/platforms.local.js` and `verbs.local.js` using the same format as the default schema files.

- 'location' property, added to platforms schema. admins can specify the full path to their custom platforms .js file.

- added sockethub executable: `bin/sockethub`

- re-factored the initialization process, we now fork off a control child which then manages the master/worker cluster for listeners, the dispatcher is handled directly by the main sockethub thread. this means no disconnects from the dispatcher when a listener fails and has to reinit.

- added redis tests to ensure a version of 2.x or greater is installed.

- additional redis abstraction and returned value vetting

- platforms: added `fetch` functionality to twitter platform

- examples: twitter platform additions for `fetch` verb, and bugfixes

- lots of improved error handling and bugfixes

- adjust ulimit on startup


sockethub v0.0.5 - 20.06.2013
-----------------------------

- new platform: `rss`

- updated examples to use sockethub-client repository (don't forget to `git submodule init` and `git submodule update`).

- updated examples for `rss` platform

- using 'flat-ui' ontop of twitter bootstrap for a little something different.


sockethub v0.0.4 - 20.05.2013
-----------------------------

- lots of work improving examples
  (accessible from `http://localhost:10550/examples/`)

- platform: `facebook`

- added feed reading functionality (verb: `fetch`)

- re-arranged the lib/* directory structure to make platform files more accessible and simplify the origanization.

- documentation updates`


