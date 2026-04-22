[**@sockethub/platform-irc v4.0.0-alpha.12**](../README.md)

***

[@sockethub/platform-irc](../README.md) / default

# Class: default

Defined in: [index.ts:82](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L82)

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

Defined in: [index.ts:101](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L101)

#### Parameters

##### session

`PlatformSession`

#### Returns

`IRC`

## Properties

### config

> **config**: `PersistentPlatformConfig`

Defined in: [index.ts:85](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L85)

#### Implementation of

`PersistentPlatformInterface.config`

***

### credentialsHash

> **credentialsHash**: `string`

Defined in: [index.ts:84](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L84)

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

Defined in: [index.ts:118](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L118)

Property: schema

##### Description

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

Defined in: [index.ts:355](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L355)

#### Parameters

##### done

`PlatformCallback`

#### Returns

`void`

#### Implementation of

`PersistentPlatformInterface.cleanup`

***

### connect()

> **connect**(`job`, `credentials`, `done`): `void`

Defined in: [index.ts:139](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L139)

Function: connect

Connect to an IRC server.

#### Parameters

##### job

`ActivityStream`

activity streams object

##### credentials

`PlatformIrcCredentialsObject`

credentials object

##### done

`PlatformCallback`

callback when job is done

#### Returns

`void`

#### Implementation of

`PersistentPlatformInterface.connect`

***

### disconnect()

> **disconnect**(`job`, `done`): `void`

Defined in: [index.ts:350](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L350)

Disconnect IRC client

#### Parameters

##### job

`ActivityStream`

activity streams object

##### done

`PlatformCallback`

#### Returns

`void`

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [index.ts:126](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L126)

Returns whether the platform is ready to handle jobs.
For IRC, this means we have successfully connected to the server.

#### Returns

`boolean`

#### Implementation of

`PersistentPlatformInterface.isInitialized`

***

### join()

> **join**(`job`, `done`): `void`

Defined in: [index.ts:160](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L160)

Function: join

Join a room or private conversation.

#### Parameters

##### job

`ActivityStream`

activity streams object

##### done

`PlatformCallback`

callback when job is done

#### Returns

`void`

***

### leave()

> **leave**(`job`, `done`): `void`

Defined in: [index.ts:189](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L189)

Function leave

Leave a room or private conversation.

#### Parameters

##### job

`ActivityStream`

activity streams object

##### done

`PlatformCallback`

callback when job is done

#### Returns

`void`

***

### query()

> **query**(`job`, `done`): `void`

Defined in: [index.ts:326](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L326)

Function: query

Indicate an intent to query something (e.g. get a list of users in a room).

#### Parameters

##### job

`ActivityStream`

activity streams object

##### done

`PlatformCallback`

callback when job is done

#### Returns

`void`

***

### send()

> **send**(`job`, `done`): `void`

Defined in: [index.ts:210](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L210)

Function: send

Send a message to a room or private conversation.

#### Parameters

##### job

`ActivityStream`

activity streams object

##### done

`PlatformCallback`

callback when job is done

#### Returns

`void`

***

### update()

> **update**(`job`, `credentials`, `done`): `void`

Defined in: [index.ts:278](https://github.com/sockethub/sockethub/blob/9f04cf0c5f34a9dd8be42d63fdf43e796c554c6c/packages/platform-irc/src/index.ts#L278)

Function: update

Indicate a change (i.e. room topic update, or nickname change).

#### Parameters

##### job

`ActivityStream`

activity streams object

##### credentials

`PlatformIrcCredentialsObject`

credentials to verify this user is the right one

##### done

`PlatformCallback`

callback when job is done

#### Returns

`void`
