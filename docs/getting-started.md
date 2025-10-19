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
    <script src="http://localhost:10550/sockethub-client.js" type="module"></script>
</head>
<body>
    <h1>My Sockethub App</h1>
    <button onclick="testEcho()">Test Echo</button>
    <div id="output"></div>

    <script type="module">
        import SockethubClient from '/sockethub-client.js';
        import { io } from '/socket.io.js';
        
        // Connect to Sockethub
        const sc = new SockethubClient(
            io('http://localhost:10550', {
                path: '/sockethub'
            })
        );
        
        // Listen for responses
        sc.socket.on('message', function(msg) {
            document.getElementById('output').innerHTML = 
                '<p>Response: ' + JSON.stringify(msg, null, 2) + '</p>';
        });
        
        // Test function
        window.testEcho = function() {
            // Connect and send echo message
            sc.socket.emit('message', {
                type: 'connect',
                context: 'dummy',
                actor: { id: 'test-user', type: 'person' }
            }, (response) => {
                console.log('Connect response:', response);
                
                // Send echo message after connection
                sc.socket.emit('message', {
                    type: 'echo',
                    context: 'dummy',
                    actor: { id: 'test-user', type: 'person' },
                    object: { type: 'note', content: 'Hello Sockethub!' }
                });
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
  "context": "xmpp",         // Which platform to use
  "actor": {                 // Who is performing the action
    "id": "user@example.com",
    "type": "person"
  },
  "target": {                // Where to send (optional)
    "id": "friend@example.com",
    "type": "person"
  },
  "object": {                // What to send
    "type": "note",
    "content": "Hello!"
  }
}
```

### Core Concepts

- **Platforms**: Protocol modules (dummy, feeds, irc, xmpp, metadata)
- **Context**: Which platform to use for a message
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

