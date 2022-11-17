# @sockethub/client

The client library for Sockethub.

Designed to run in both `node.js` and the `browser`.

## Install

### Node.js

`$ npm install @sockethub/client`

#### CommonJS

```javascript
const SockethubClient = require('@sockethub/client');
const io = require('@socket.io-client');
const SOCKETHUB_SERVER = 'http://localhost:10550';
const sc = SockethubClient(io(SOCKETHUB_SERVER));
```

#### ESM

```javascript
import SockethubClient from '@sockethub/client';
import { io } from '@socket.io-client';
const SOCKETHUB_SERVER = 'http://localhost:10550';
const sc = SockethubClient(io(SOCKETHUB_SERVER));
```

### Browser

The browser bundle is available in the dist folder:

```
import '@sockethub/client/dist/sockethub-client.js';
```

You can place it somewhere accessible from the web and include 
it via a `script` tag.

```
<script src="http://example.com/sockethub-client.js"></script>
```

Once included in a web-page, the `SockethubClient` base object 
should be on the global scope.
