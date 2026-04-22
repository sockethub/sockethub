# Interface: IrcSocketInstance

Defined in: [ambient.d.ts:2](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/ambient.d.ts#L2)

## Properties

### connect()

> **connect**: () => `Promise`\<`unknown`\>

Defined in: [ambient.d.ts:10](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/ambient.d.ts#L10)

#### Properties connect() Returns

`Promise`\<`unknown`\>

***

### end()?

> `optional` **end**: () => `void`

Defined in: [ambient.d.ts:3](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/ambient.d.ts#L3)

#### Properties end()? Returns

`void`

***

### on()

> **on**: (`event`, `handler`) => `void`

Defined in: [ambient.d.ts:9](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/ambient.d.ts#L9)

#### Properties on() Parameters

| Parameter | Type |
| ------ | ------ |
| `event` | `string` |
| `handler` | (...`args`) => `void` |

#### Properties on() Returns

`void`

***

### once()

> **once**: (`event`, `handler`) => `void`

Defined in: [ambient.d.ts:5](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/ambient.d.ts#L5)

#### Properties once() Parameters

| Parameter | Type |
| ------ | ------ |
| `event` | `string` |
| `handler` | (...`args`) => `void` |

#### Properties once() Returns

`void`

***

### raw()

> **raw**: (`message`) => `void`

Defined in: [ambient.d.ts:4](https://github.com/sockethub/sockethub/blob/5859b33363ef280eb3802f335260098baea5cc19/packages/platform-irc/src/ambient.d.ts#L4)

#### Properties raw() Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |

#### Properties raw() Returns

`void`
