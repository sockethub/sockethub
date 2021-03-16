[![Sockethub](http://sockethub.org/res/img/sockethub-logo.svg)](http://sockethub.org)

A protocol gateway for the web.

[![Build Status](https://www.travis-ci.com/sockethub/sockethub.svg?branch=master)](https://travis-ci.com/sockethub/sockethub)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/sockethub/sockethub.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/sockethub/sockethub/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/sockethub/sockethub.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/sockethub/sockethub/context:javascript)
[![Maintainability](https://api.codeclimate.com/v1/badges/95912fc801271faf44f6/maintainability)](https://codeclimate.com/github/sockethub/sockethub/maintainability)
[![Release](https://img.shields.io/npm/v/sockethub.svg?style=flat)](https://github.com/sockethub/sockethub/releases)
[![Lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

## About

*The monorepo for the Sockethub project.*

Sockethub is a translation layer for web applications to communicate with other protocols and services that are traditionally either inaccessible or impractical to use from in-browser JavaScript.

**For more information on Sockethub see the [Sockethub README](packages/sockethub/README.md)**

## Setup

### Install Dependencies

```$ yarn install```

### Run Tests

```$ yarn test```

### Run Linter

```$ yarn lint:js```

Or, to automatically fix linting errors:

```$ yarn lint:fix```

## Running

For development purposes, with examples enabled, run:

`$ DEBUG=sockethub* yarn run dev`

You should then be able to browse to `http://localhost:10550` and try out the examples.

For production, with examples disabled.

`$ DEBUG=sockethub* yarn run start`

*For more info on configuration options, see the [Sockethub README](packages/sockethub/README.md#environment-variables)* section on environment variables.*

## Packages

* [activity-streams.js](packages/activity-streams.js)
* [irc2as](packages/irc2as)
* [sockethub](packages/sockethub)
* [sockethub-platform-dummy](packages/sockethub-platform-dummy)
* [sockethub-platform-feeds](packages/sockethub-platform-feeds)
* [sockethub-platform-irc](packages/sockethub-platform-irc)
* [sockethub-platform-xmpp](packages/sockethub-platform-xmpp)
* [sockethub-schemas](packages/sockethub-schemas)

## Credits

Project created and maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/res/img/nlnet-logo.svg)](http://nlnet.nl)

