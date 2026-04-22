# Interface: IrcSocketInstance

Defined in: [ambient.d.ts:2](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/ambient.d.ts#L2)

## Properties

### connect()

> **connect**: () => `Promise`\<`unknown`\>

Defined in: [ambient.d.ts:10](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/ambient.d.ts#L10)

#### Returns

`Promise`\<`unknown`\>

***

### end()?

> `optional` **end**: () => `void`

Defined in: [ambient.d.ts:3](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/ambient.d.ts#L3)

#### Returns

`void`

***

### on()

> **on**: (`event`, `handler`) => `void`

Defined in: [ambient.d.ts:9](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/ambient.d.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `event` | `string` |
| `handler` | (...`args`) => `void` |

#### Returns

`void`

***

### once()

> **once**: (`event`, `handler`) => `void`

Defined in: [ambient.d.ts:5](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/ambient.d.ts#L5)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `event` | `string` |
| `handler` | (...`args`) => `void` |

#### Returns

`void`

***

### raw()

> **raw**: (`message`) => `void`

Defined in: [ambient.d.ts:4](https://github.com/sockethub/sockethub/blob/fe9eb6244faf8131d630082d4435fb1fcac8f4fa/packages/platform-irc/src/ambient.d.ts#L4)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |

#### Returns

`void`
