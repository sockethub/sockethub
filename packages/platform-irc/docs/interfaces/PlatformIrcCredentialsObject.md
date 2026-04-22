# Interface: PlatformIrcCredentialsObject

Defined in: [types.ts:3](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/types.ts#L3)

## Extends

- `CredentialsObject`

## Properties

### @context

> **@context**: `string`[]

Defined in: [types.ts:4](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/types.ts#L4)

#### Properties @context Overrides

`CredentialsObject.@context`

***

### actor

> **actor**: `ActivityActor`

Defined in: [types.ts:6](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/types.ts#L6)

#### Properties actor Overrides

`CredentialsObject.actor`

***

### object

> **object**: `object`

Defined in: [types.ts:8](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/types.ts#L8)

#### nick

> **nick**: `string`

#### password?

> `optional` **password**: `string`

#### port?

> `optional` **port**: `number`

#### sasl?

> `optional` **sasl**: `boolean`

#### saslMechanism?

> `optional` **saslMechanism**: `"PLAIN"` \| `"OAUTHBEARER"`

#### secure?

> `optional` **secure**: `boolean`

#### server

> **server**: `string`

#### token?

> `optional` **token**: `string`

#### Properties object type

> **type**: `"credentials"`

#### username?

> `optional` **username**: `string`

#### Properties object Overrides

`CredentialsObject.object`

***

### target?

> `optional` **target**: `ActivityActor`

Defined in: [types.ts:7](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/types.ts#L7)

#### Properties target? Overrides

`CredentialsObject.target`

***

### Properties type

> **type**: `"credentials"`

Defined in: [types.ts:5](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/types.ts#L5)

#### Properties type Overrides

`CredentialsObject.type`
