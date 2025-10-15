# Quick Start Guide

Get up and running with Sockethub in 5 minutes.

## 1. Installation

Ensure you have the prerequisites installed:

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Start Redis (choose one)
brew services start redis              # macOS
sudo systemctl start redis            # Linux
docker run -d -p 6379:6379 redis:alpine  # Docker
```

Clone and set up Sockethub:

```bash
git clone https://github.com/sockethub/sockethub.git
cd sockethub
bun install
bun run dev
```

## 2. Verify Installation

Open your browser to `http://localhost:10550` and you should see the Sockethub welcome page
with interactive examples.

## 3. Try the Examples

### Dummy Platform Test

1. Go to the **Dummy** platform example
2. Click "Connect" - this should succeed immediately
3. Try sending an "echo" message
4. You should receive the same message back

### Feed Reader Example

1. Go to the **Feeds** platform example
2. Enter a feed URL (e.g., `https://feeds.feedburner.com/oreilly/radar`)
3. Click "Fetch Feed"
4. You should see the latest feed entries displayed

## 4. Build Your First App

Create a simple HTML file that connects to Sockethub:

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
        // Connect to Sockethub
        const io_socket = io('http://localhost:10550', {
            path: '/sockethub'
        });
        
        const sc = new SockethubClient(io_socket);
        
        // Listen for responses
        sc.socket.on('completed', function(msg) {
            document.getElementById('output').innerHTML = 
                '<p>Response: ' + JSON.stringify(msg, null, 2) + '</p>';
        });
        
        // Test function
        function testEcho() {
            // Connect to dummy platform
            sc.socket.emit('message', {
                '@type': 'connect',
                context: 'dummy',
                actor: {
                    '@id': 'test-user',
                    '@type': 'person'
                }
            });
            
            // Send echo message
            setTimeout(() => {
                sc.socket.emit('message', {
                    '@type': 'echo',
                    context: 'dummy',
                    actor: {
                        '@id': 'test-user',
                        '@type': 'person'
                    },
                    object: {
                        '@type': 'note',
                        content: 'Hello Sockethub!'
                    }
                });
            }, 100);
        }
    </script>
</body>
</html>
```

## 5. Understanding the Basics

### ActivityStreams Messages

All communication with Sockethub uses ActivityStreams 2.0 format:

```javascript
{
  "@type": "send",           // The action to perform
  "context": "xmpp",         // Which platform to use
  "actor": {                 // Who is performing the action
    "@id": "user@example.com",
    "@type": "person"
  },
  "target": {                // Where to send (optional)
    "@id": "friend@example.com",
    "@type": "person"
  },
  "object": {                // What to send
    "@type": "note",
    "content": "Hello!"
  }
}
```

### Core Concepts

- **Platforms**: Protocol modules (dummy, feeds, irc, xmpp, metadata)
- **Context**: Which platform to use for a message
- **Actor**: The user performing the action
- **Verbs**: Actions like connect, send, join, fetch
- **Objects**: Data being sent (messages, credentials, etc.)

### Common Verbs

- `connect` - Establish connection to a service
- `send` - Send a message or data
- `fetch` - Retrieve information
- `join` - Join a room/channel
- `leave` - Leave a room/channel
- `update` - Update status or information

## 6. Next Steps

### For App Developers

- **[Client Documentation](../client/README.md)** - Detailed client library usage
- **[Using Platforms](../client/using-platforms.md)** - Working with specific platforms
- **[ActivityStreams Guide](../client/activitystreams.md)** - Understanding message format

### For Platform Developers

- **[Creating Platforms](../platform-development/creating-platforms.md)** - Build custom platforms
- **[Platform API](../platform-development/platform-api.md)** - Development interface

### Production Deployment

- **[Configuration](configuration.md)** - Advanced configuration options
- **[Production Guide](../deployment/production.md)** - Deploy Sockethub in production
- **[Server Configuration](../deployment/server-config.md)** - Reverse proxy setup

## Troubleshooting

**Connection issues:**

- Verify Redis is running: `redis-cli ping`
- Check browser console for errors
- Ensure Sockethub is running on port 10550

**Platform errors:**

- Check server logs for error details
- Verify platform-specific requirements
- Test with dummy platform first

**CORS issues:**

- Sockethub server handles CORS automatically
- Ensure you're connecting to the correct URL and port
