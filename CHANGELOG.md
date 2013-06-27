CHANGELOG
=========

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


