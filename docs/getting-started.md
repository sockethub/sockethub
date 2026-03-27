# Getting Started with Sockethub

Get up and running with Sockethub in 5 minutes.

## Prerequisites

- **Node.js** v18+ or **Bun** v1.2+ (examples use Bun)
- **Redis** server v6.0+ running locally or remotely

## Installation

### Method 1: From npm

```bash
npm install -g sockethub
sockethub --examples
```

### Method 2: From source (recommended for development)

```bash
git clone https://github.com/sockethub/sockethub.git
cd sockethub
bun install
bun run dev
```

Both methods start Sockethub on `http://localhost:10550`.

## Try the Examples

Browse to `http://localhost:10550` to see interactive examples for each platform:

- **Dummy Platform**: Test basic connectivity with echo messages
- **Feeds Platform**: Fetch and display RSS/Atom feeds
- **IRC/XMPP Platforms**: Connect to chat networks (requires credentials)

These examples demonstrate real Sockethub usage and provide copy-paste code for your own applications.

## Build Your First App

Create a simple HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Sockethub App</title>
    <script src="http://localhost:10550/socket.io.js"></script>
    <script src="http://localhost:10550/sockethub-client.js"></script>
</head>
<body>
    <h1>My Sockethub App</h1>
    <button onclick="testEcho()">Test Echo</button>
    <div id="output"></div>

    <script>
        // Connect to Sockethub (SockethubClient and io are globals from script tags)
        const sc = new SockethubClient(
            io('http://localhost:10550', {
                path: '/sockethub'
            }),
            { initTimeoutMs: 5000 }
        );

        // Listen for responses
        sc.socket.on('message', function(msg) {
            document.getElementById('output').textContent =
                'Response: ' + JSON.stringify(msg, null, 2);
        });

        // Test function
        window.testEcho = async function() {
            // Wait for schema registry
            try {
                await sc.ready();
            } catch (err) {
                document.getElementById('output').textContent =
                    'Initialization failed: ' + String(err);
                return;
            }

            // Send echo message
            sc.socket.emit('message', {
                type: 'echo',
                '@context': sc.contextFor('dummy'),
                actor: { id: 'test-user', type: 'person' },
                object: { type: 'message', content: 'Hello Sockethub!' }
            }, (echoResponse) => {
                document.getElementById('output').textContent =
                    'Echo: ' + JSON.stringify(echoResponse, null, 2);
            });
        }
    </script>
</body>
</html>
```

## Understanding the Basics

### ActivityStreams Messages

All communication uses ActivityStreams 2.0 format:

```javascript
{
  "type": "send",            // The action to perform
  "@context": [              // Which platform to use
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld"
  ],
  "actor": {                 // Who is performing the action
    "id": "user@example.com",
    "type": "person"
  },
  "target": {                // Where to send (optional)
    "id": "friend@example.com",
    "type": "person"
  },
  "object": {                // What to send
    "type": "message",
    "content": "Hello!"
  }
}
```

### Core Concepts

- **Platforms**: Protocol modules (dummy, feeds, irc, xmpp, metadata)
- **@context**: Canonical context array that selects which platform to use
- **Actor**: The user performing the action  
- **Verbs**: Actions like connect, send, join, fetch

## Production Usage

```bash
# Build for production
bun run build

# Start production server (examples disabled)
bun run start
```

## Next Steps

### For App Developers

- **[Client Guide](client-guide.md)** - Detailed client library usage
- **[Platform Documentation](platforms.md)** - Working with specific platforms
- **[Configuration](configuration.md)** - Server configuration options

### For Platform Developers

- **[Creating Platforms](platform-development/creating-platforms.md)** - Build custom platforms
- **[Platform API](platform-development/platform-api.md)** - Development interface
