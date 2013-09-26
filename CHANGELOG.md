CHANGELOG
=========

sockethub v0.1.1 - 26.09.2013
-----------------------------

- introduction of a way for platforms to persist an object beyond a single session, with `session.clientManager`. ([client-manager.js](https://github.com/sockethub/sockethub/blob/master/lib/sockethub/client-manager.js))

- re-factored session objects to provide better code documentation and clarify the different roles. ([session.js](https://github.com/sockethub/sockethub/blob/master/lib/sockethub/session.js))

- by default, debug logging is now switched off, so the console output should be a bit less overwhelming :)

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

- the dispatcher verifies the platforms of incoming commands against
  a list of platforms that the dispatcher has received pings from
  during initialization, otherwise the command fails. ([issue #45](https://github.com/sockethub/sockethub/issues/45))

- revisiting the redis error, this time a few uses of the redis client
  were tracked down in the session object and fixed. ([issue #84](https://github.com/sockethub/sockethub/issues/84))

- dispatcher was sending cleanup to subsystem (and therefore quitting
  the subsystem redis channel) at the wrong point (during session end
  instead of during shutdown). ([issue #96](https://github.com/sockethub/sockethub/issues/96))

- when a listener is spawned (or re-spawned) it now waits until it receives
  the encryption key from the dispatcher before it queues for a job. ([issue #97](https://github.com/sockethub/sockethub/issues/97))

- platforms: (rss) feed data not passed to client encoded as UTF-8 ([issue #99](https://github.com/sockethub/sockethub/issues/99))

- platforms: (rss) job is now completed only after all articles are fetched
  and sent to client.  ([issue #98](https://github.com/sockethub/sockethub/issues/98))


sockethub v0.0.9 - 26.07.2013
-----------------------------

- simplified promise fulfillment for platforms ([issue #82](https://github.com/sockethub/sockethub/issues/82))

- improved session cleanup handling

- address some listener promise handling issues

- some small stability fixes related to redis connection hiccups


sockethub v0.0.8 - 19.07.2013
-----------------------------

- fixed some error handling in twitter platform ([issue #89](https://github.com/sockethub/sockethub/issues/89))

- reworked redis connection management, implemented connection pool.
  ([issues #84](https://github.com/sockethub/sockethub/issues/84) & [#74](https://github.com/sockethub/sockethub/issues/74))

- handle SIGINT as early as possible.

- fixed race condition where a command sent immediately upon connect could be
  lost. ([issue #90](https://github.com/sockethub/sockethub/issues/90))

- greatly improved session cleanup handling, removed some old cruft. ([issue #92](https://github.com/sockethub/sockethub/issues/92))

- added a 'cleanup' listener for listeners to register with session objects to
  know when the dispatcher has sent out a cleanup. ([issue #92](https://github.com/sockethub/sockethub/issues/92))

- many small bugfixes


sockethub v0.0.7 - 10.07.2013
-----------------------------

- multithreading refactor, to improve decoupling and communication between
  dispatcher and listener(s), as well as improved stability and respawning
  worker threads

- bugfixes in twitter platform

- addition of imap supoprt to fetch verb in the email platform

- NOTE: npm test may fail as one of its dependencies (test) requires v0.0.18
  which is unable to publish to npm at the moment, hopefully this is resolved
  soon.


sockethub v0.0.6 - 28.06.2013
-----------------------------

- simplified `lib/schemas/platforms.js` and verbs.js for less typing when adding
  new verbs or platforms (no name property required and verbs list is an array
  of strings).

- sockethub admins can now add custom platforms or verbs by creating a 'local'
  schema in `libs/schemas/platforms.local.js` and `verbs.local.js` using the
  same format as the default schema files.

- 'location' property, added to platforms schema. admins can specify the full
  path to their custom platforms .js file.

- added sockethub executable: `bin/sockethub`

- re-factored the initialization process, we now fork off a control child which
  then manages the master/worker cluster for listeners, the dispatcher is
  handled directly by the main sockethub thread. this means no disconnects
  from the dispatcher when a listener fails and has to reinit.

- added redis tests to ensure a version of 2.x or greater is installed.

- additional redis abstraction and returned value vetting

- platforms: added `fetch` functionality to twitter platform

- examples: twitter platform additions for `fetch` verb, and bugfixes

- lots of improved error handling and bugfixes

- adjust ulimit on startup


sockethub v0.0.5 - 20.06.2013
-----------------------------

- new platform: `rss`

- updated examples to use sockethub-client repository (don't forget to `git
  submodule init` and `git submodule update`).

- updated examples for `rss` platform

- using 'flat-ui' ontop of twitter bootstrap for a little something different.


sockethub v0.0.4 - 20.05.2013
-----------------------------

- lots of work improving examples
  (accessible from `http://localhost:10550/examples/`)

- platform: `facebook`

  - added feed reading functionality (verb: `fetch`)

- re-arranged the lib/* directory structure to make platform files more
  accessible and simplify the origanization.

- documentation updates`


