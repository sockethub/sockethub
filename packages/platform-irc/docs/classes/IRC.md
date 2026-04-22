# Class: IRC

Defined in: [index.ts:79](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L79)

Handles all actions related to communication via the IRC protocol.

## Implements

- `PersistentPlatformInterface`

## Constructors

### Constructor

> **new IRC**(`session`): `IRC`

Defined in: [index.ts:98](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L98)

#### Constructors Constructor Parameters

| Parameter | Type |
| ------ | ------ |
| `session` | `PlatformSession` |

#### Constructors Constructor Returns

`IRC`

## Properties

### config

> **config**: `PersistentPlatformConfig`

Defined in: [index.ts:82](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L82)

#### Properties config Implementation of

`PersistentPlatformInterface.config`

***

### credentialsHash

> **credentialsHash**: `string`

Defined in: [index.ts:81](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L81)

Hash of the credentials object this platform instance is bound to.
Used to validate that incoming requests match the actor this instance serves.
Prevents credential mismatches and ensures single-actor per instance.

May be undefined before credentials are established. Callers should handle both cases.

#### Properties credentialsHash Implementation of

`PersistentPlatformInterface.credentialsHash`

## Accessors

### schema

#### Accessors schema Get Signature

> **get** **schema**(): `PlatformSchemaStruct`

Defined in: [index.ts:112](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L112)

JSON schema defining the types this platform accepts.

`password` and `token` are mutually exclusive. Both default to SASL
PLAIN; set `saslMechanism: 'OAUTHBEARER'` explicitly for OAuth 2.0
bearer tokens (RFC 7628). See the package README for canonical
credentials payload examples.

##### Accessors schema Accessors schema Get Signature Returns

`PlatformSchemaStruct`

#### Accessors schema Implementation of

`PersistentPlatformInterface.schema`

## Methods

### cleanup()

> **cleanup**(`done`): `void`

Defined in: [index.ts:349](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L349)

#### Methods cleanup() Parameters

| Parameter | Type |
| ------ | ------ |
| `done` | `PlatformCallback` |

#### Methods cleanup() Returns

`void`

#### Methods cleanup() Implementation of

`PersistentPlatformInterface.cleanup`

***

### connect()

> **connect**(`job`, `credentials`, `done`): `void`

Defined in: [index.ts:133](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L133)

Function: connect

Connect to an IRC server.

#### Methods connect() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `credentials` | [`PlatformIrcCredentialsObject`](../interfaces/PlatformIrcCredentialsObject.md) | credentials object |
| `done` | `PlatformCallback` | callback when job is done |

#### Methods connect() Returns

`void`

#### Methods connect() Implementation of

`PersistentPlatformInterface.connect`

***

### disconnect()

> **disconnect**(`job`, `done`): `void`

Defined in: [index.ts:344](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L344)

Disconnect IRC client

#### Methods disconnect() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` |  |

#### Methods disconnect() Returns

`void`

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [index.ts:120](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L120)

Returns whether the platform is ready to handle jobs.
For IRC, this means we have successfully connected to the server.

#### Methods isInitialized() Returns

`boolean`

#### Methods isInitialized() Implementation of

`PersistentPlatformInterface.isInitialized`

***

### join()

> **join**(`job`, `done`): `void`

Defined in: [index.ts:154](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L154)

Function: join

Join a room or private conversation.

#### Methods join() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### Methods join() Returns

`void`

***

### leave()

> **leave**(`job`, `done`): `void`

Defined in: [index.ts:183](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L183)

Function leave

Leave a room or private conversation.

#### Methods leave() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### Methods leave() Returns

`void`

***

### query()

> **query**(`job`, `done`): `void`

Defined in: [index.ts:320](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L320)

Function: query

Indicate an intent to query something (e.g. get a list of users in a room).

#### Methods query() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### Methods query() Returns

`void`

***

### send()

> **send**(`job`, `done`): `void`

Defined in: [index.ts:204](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L204)

Function: send

Send a message to a room or private conversation.

#### Methods send() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### Methods send() Returns

`void`

***

### update()

> **update**(`job`, `credentials`, `done`): `void`

Defined in: [index.ts:272](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/index.ts#L272)

Function: update

Indicate a change (i.e. room topic update, or nickname change).

#### Methods update() Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `credentials` | [`PlatformIrcCredentialsObject`](../interfaces/PlatformIrcCredentialsObject.md) | credentials to verify this user is the right one |
| `done` | `PlatformCallback` | callback when job is done |

#### Methods update() Returns

`void`
