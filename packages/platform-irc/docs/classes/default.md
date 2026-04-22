# Class: default

Defined in: [index.ts:82](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L82)

IRC

## Description

Handles all actions related to communication via. the IRC protocol.

## Param

a unique config object for this instance

## Implements

- `PersistentPlatformInterface`

## Constructors

### Constructor

> **new default**(`session`): `IRC`

Defined in: [index.ts:101](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L101)

#### Constructor Parameters

| Parameter | Type |
| ------ | ------ |
| `session` | `PlatformSession` |

#### Constructor Returns

`IRC`

## Properties

### config

> **config**: `PersistentPlatformConfig`

Defined in: [index.ts:85](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L85)

#### config Implementation of

`PersistentPlatformInterface.config`

***

### credentialsHash

> **credentialsHash**: `string`

Defined in: [index.ts:84](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L84)

Hash of the credentials object this platform instance is bound to.
Used to validate that incoming requests match the actor this instance serves.
Prevents credential mismatches and ensures single-actor per instance.

May be undefined before credentials are established. Callers should handle both cases.

#### credentialsHash Implementation of

`PersistentPlatformInterface.credentialsHash`

## Accessors

### schema

#### schema Get Signature

> **get** **schema**(): `PlatformSchemaStruct`

Defined in: [index.ts:118](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L118)

Property: schema

##### schema Get Signature Description

JSON schema defining the types this platform accepts.

`password` and `token` are mutually exclusive. Both default to SASL
PLAIN; set `saslMechanism: 'OAUTHBEARER'` explicitly for OAuth 2.0
bearer tokens (RFC 7628). See the package README for canonical
credentials payload examples.

##### schema Get Signature Returns

`PlatformSchemaStruct`

#### schema Implementation of

`PersistentPlatformInterface.schema`

## Methods

### cleanup()

> **cleanup**(`done`): `void`

Defined in: [index.ts:355](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L355)

#### cleanup() Parameters

| Parameter | Type |
| ------ | ------ |
| `done` | `PlatformCallback` |

#### cleanup() Returns

`void`

#### cleanup() Implementation of

`PersistentPlatformInterface.cleanup`

***

### connect()

> **connect**(`job`, `credentials`, `done`): `void`

Defined in: [index.ts:139](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L139)

Function: connect

Connect to an IRC server.

#### connect() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `credentials` | `PlatformIrcCredentialsObject` | credentials object |
| `done` | `PlatformCallback` | callback when job is done |

#### connect() Returns

`void`

#### connect() Implementation of

`PersistentPlatformInterface.connect`

***

### disconnect()

> **disconnect**(`job`, `done`): `void`

Defined in: [index.ts:350](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L350)

Disconnect IRC client

#### disconnect() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` |  |

#### disconnect() Returns

`void`

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [index.ts:126](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L126)

Returns whether the platform is ready to handle jobs.
For IRC, this means we have successfully connected to the server.

#### isInitialized() Returns

`boolean`

#### isInitialized() Implementation of

`PersistentPlatformInterface.isInitialized`

***

### join()

> **join**(`job`, `done`): `void`

Defined in: [index.ts:160](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L160)

Function: join

Join a room or private conversation.

#### join() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### join() Returns

`void`

***

### leave()

> **leave**(`job`, `done`): `void`

Defined in: [index.ts:189](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L189)

Function leave

Leave a room or private conversation.

#### leave() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### leave() Returns

`void`

***

### query()

> **query**(`job`, `done`): `void`

Defined in: [index.ts:326](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L326)

Function: query

Indicate an intent to query something (e.g. get a list of users in a room).

#### query() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### query() Returns

`void`

***

### send()

> **send**(`job`, `done`): `void`

Defined in: [index.ts:210](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L210)

Function: send

Send a message to a room or private conversation.

#### send() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### send() Returns

`void`

***

### update()

> **update**(`job`, `credentials`, `done`): `void`

Defined in: [index.ts:278](https://github.com/sockethub/sockethub/blob/b8e3084f355a7f9e9d669d3b85a784d8483099d2/packages/platform-irc/src/index.ts#L278)

Function: update

Indicate a change (i.e. room topic update, or nickname change).

#### update() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `credentials` | `PlatformIrcCredentialsObject` | credentials to verify this user is the right one |
| `done` | `PlatformCallback` | callback when job is done |

#### update() Returns

`void`
