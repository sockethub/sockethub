# Class: IRC

Defined in: [index.ts:79](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L79)

Handles all actions related to communication via the IRC protocol.

## Implements

- `PersistentPlatformInterface`

## Constructors

### Constructor

> **new IRC**(`session`): `IRC`

Defined in: [index.ts:98](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L98)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `session` | `PlatformSession` |

#### Returns

`IRC`

## Properties

### config

> **config**: `PersistentPlatformConfig`

Defined in: [index.ts:82](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L82)

#### Implementation of

`PersistentPlatformInterface.config`

***

### credentialsHash

> **credentialsHash**: `string`

Defined in: [index.ts:81](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L81)

Hash of the credentials object this platform instance is bound to.
Used to validate that incoming requests match the actor this instance serves.
Prevents credential mismatches and ensures single-actor per instance.

May be undefined before credentials are established. Callers should handle both cases.

#### Implementation of

`PersistentPlatformInterface.credentialsHash`

## Accessors

### schema

#### Get Signature

> **get** **schema**(): `PlatformSchemaStruct`

Defined in: [index.ts:112](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L112)

JSON schema defining the types this platform accepts.

`password` and `token` are mutually exclusive. Both default to SASL
PLAIN; set `saslMechanism: 'OAUTHBEARER'` explicitly for OAuth 2.0
bearer tokens (RFC 7628). See the package README for canonical
credentials payload examples.

##### Returns

`PlatformSchemaStruct`

#### Implementation of

`PersistentPlatformInterface.schema`

## Methods

### cleanup()

> **cleanup**(`done`): `void`

Defined in: [index.ts:349](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L349)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `done` | `PlatformCallback` |

#### Returns

`void`

#### Implementation of

`PersistentPlatformInterface.cleanup`

***

### connect()

> **connect**(`job`, `credentials`, `done`): `void`

Defined in: [index.ts:133](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L133)

Function: connect

Connect to an IRC server.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `credentials` | [`PlatformIrcCredentialsObject`](../interfaces/PlatformIrcCredentialsObject.md) | credentials object |
| `done` | `PlatformCallback` | callback when job is done |

#### Returns

`void`

#### Implementation of

`PersistentPlatformInterface.connect`

***

### disconnect()

> **disconnect**(`job`, `done`): `void`

Defined in: [index.ts:344](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L344)

Disconnect IRC client

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` |  |

#### Returns

`void`

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [index.ts:120](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L120)

Returns whether the platform is ready to handle jobs.
For IRC, this means we have successfully connected to the server.

#### Returns

`boolean`

#### Implementation of

`PersistentPlatformInterface.isInitialized`

***

### join()

> **join**(`job`, `done`): `void`

Defined in: [index.ts:154](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L154)

Function: join

Join a room or private conversation.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### Returns

`void`

***

### leave()

> **leave**(`job`, `done`): `void`

Defined in: [index.ts:183](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L183)

Function leave

Leave a room or private conversation.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### Returns

`void`

***

### query()

> **query**(`job`, `done`): `void`

Defined in: [index.ts:320](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L320)

Function: query

Indicate an intent to query something (e.g. get a list of users in a room).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### Returns

`void`

***

### send()

> **send**(`job`, `done`): `void`

Defined in: [index.ts:204](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L204)

Function: send

Send a message to a room or private conversation.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `done` | `PlatformCallback` | callback when job is done |

#### Returns

`void`

***

### update()

> **update**(`job`, `credentials`, `done`): `void`

Defined in: [index.ts:272](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/index.ts#L272)

Function: update

Indicate a change (i.e. room topic update, or nickname change).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `job` | `ActivityStream` | activity streams object |
| `credentials` | [`PlatformIrcCredentialsObject`](../interfaces/PlatformIrcCredentialsObject.md) | credentials to verify this user is the right one |
| `done` | `PlatformCallback` | callback when job is done |

#### Returns

`void`
