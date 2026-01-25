/**
 * Artillery processor using @sockethub/client
 * This ensures proper ActivityStreams formatting and error handling
 */

// CommonJS imports (Artillery runs in Node.js)
const SockethubClient = require("@sockethub/client").default;
const { io } = require("socket.io-client");

// Circuit breaker - abort test if Sockethub becomes unavailable
const FAILURE_THRESHOLD = 10; // Consecutive failures before abort
let consecutiveFailures = 0;
let lastSuccessTime = Date.now();

function checkCircuitBreaker() {
    if (consecutiveFailures >= FAILURE_THRESHOLD) {
        const downtime = Math.round((Date.now() - lastSuccessTime) / 1000);
        console.error("\n╔══════════════════════════════════════════════════════════╗");
        console.error("║  ❌ SOCKETHUB UNAVAILABLE - ABORTING STRESS TEST          ║");
        console.error("╚══════════════════════════════════════════════════════════╝");
        console.error(`\n${consecutiveFailures} consecutive connection failures`);
        console.error(`Sockethub has been down for ~${downtime}s`);
        console.error("Check server logs for crash details.\n");
        process.exit(1);
    }
}

function recordSuccess() {
    consecutiveFailures = 0;
    lastSuccessTime = Date.now();
}

function recordFailure() {
    consecutiveFailures++;
    checkCircuitBreaker();
}

module.exports = {
    setupClient,
    sendCredentials,
    sendDummyEcho,
    sendXMPPMessage,
    sendFeedMessage,
    disconnectClient,
};

/**
 * Setup Sockethub client for this virtual user
 */
function setupClient(context, events, done) {
    // Circuit breaker - abort if server appears down
    if (circuitBreakerTriggered) {
        const now = Date.now();
        if (now - lastAlertTime > ALERT_INTERVAL_MS) {
            console.error(
                `\n⚠️  CIRCUIT BREAKER OPEN: Sockethub unavailable (${consecutiveConnectionFailures} failures). Waiting for test to end...\n`,
            );
            lastAlertTime = now;
        }
        events.emit("counter", "sockethub.circuit_breaker", 1);
        return done(new Error("Circuit breaker open"));
    }

    if (consecutiveConnectionFailures >= MAX_CONSECUTIVE_FAILURES && !circuitBreakerTriggered) {
        circuitBreakerTriggered = true;
        console.error(
            `\n🛑 CIRCUIT BREAKER TRIGGERED: ${consecutiveConnectionFailures} consecutive failures.\n` +
            `   Sockethub appears to be down. Aborting new connections.\n` +
            `   Press Ctrl+C to stop the test.\n`,
        );
        lastAlertTime = Date.now();
        events.emit("counter", "sockethub.circuit_breaker", 1);
        return done(new Error("Circuit breaker triggered - server unavailable"));
    }

    const socket = io("http://localhost:10550", {
        path: "/sockethub",
        transports: ["websocket"],
        reconnection: false, // Don't auto-reconnect during stress tests
        timeout: 2000,
    });

    context.vars.client = new SockethubClient(socket);
    context.vars.actorId = `test-${context.vars.$uuid}@dummy`;
    context.vars.errors = [];
    context.vars.connected = false;

    // Track connection
    socket.on("connect", () => {
        events.emit("counter", "sockethub.connected", 1);
        context.vars.connected = true;
        recordSuccess();
    });

    socket.on("connect_error", (err) => {
        events.emit("counter", "sockethub.connect_error", 1);
        consecutiveConnectionFailures++;
        // Only log first few errors
        if (consecutiveConnectionFailures <= 3) {
            console.error(`Connection error (${consecutiveConnectionFailures}): ${err.message}`);
        }
        context.vars.errors.push(`Connection: ${err.message}`);
        recordFailure();
    });

    socket.on("disconnect", (reason) => {
        if (reason === "transport close" || reason === "transport error") {
            recordFailure();
        }
    });

    // Wait for connection or timeout
    setTimeout(() => {
        if (!context.vars.connected) {
            consecutiveConnectionFailures++;
            if (consecutiveConnectionFailures <= 3) {
                console.error("Connection timeout - socket never connected");
            }
            events.emit("counter", "sockethub.connect_timeout", 1);
            context.vars.errors.push("Connection timeout");
            recordFailure();
        }
        done();
    }, 2000);
}

/**
 * Send credentials and register actor
 */
function sendCredentials(context, events, done) {
    const client = context.vars.client;
    const actorId = context.vars.actorId;

    // Check if connected
    if (!context.vars.connected) {
        events.emit("counter", "sockethub.error.not_connected", 1);
        console.error("Cannot send credentials - not connected");
        return done();
    }

    // Create actor object using client's ActivityStreams API
    const actor = client.ActivityStreams.Object.create({
        id: actorId,
        type: "person",
        name: `Test User ${context.vars.$uuid}`,
    });

    // Send credentials message (uses 'credentials' event, not 'message')
    const credentialsMsg = {
        type: "credentials",
        context: "dummy",
        actor: {
            id: actorId,
            type: "person",
        },
        object: {
            id: `creds-${context.vars.$uuid}`,
            type: "credentials",
            secret: "test-secret",
        },
    };

    client.socket.emit("credentials", credentialsMsg, (response) => {
        if (response?.error) {
            events.emit("counter", "sockethub.error.credentials", 1);
            console.error("Credentials error:", response.error);
            context.vars.errors.push(`Credentials: ${response.error}`);
        } else {
            events.emit("counter", "sockethub.success.credentials", 1);
        }
        done();
    });
}

/**
 * Send Dummy echo message with error handling
 */
function sendDummyEcho(context, events, done) {
    const client = context.vars.client;
    const actorId = context.vars.actorId;

    const message = {
        type: "echo",
        context: "dummy",
        actor: {
            id: actorId,
            type: "person",
        },
        object: {
            id: `echo-${Date.now()}`,
            type: "message",
            content: `Test echo ${Date.now()}`,
        },
    };

    const startTime = Date.now();

    client.socket.emit("message", message, (response) => {
        const latency = Date.now() - startTime;
        events.emit("histogram", "sockethub.latency.echo", latency);

        if (response?.error) {
            events.emit("counter", "sockethub.error.echo", 1);
            console.error("Echo error:", response.error);
            context.vars.errors.push(`Echo: ${response.error}`);
        } else {
            events.emit("counter", "sockethub.success.echo", 1);
        }
        done();
    });
}

/**
 * Send XMPP message with error handling
 */
function sendXMPPMessage(context, events, done) {
    const client = context.vars.client;
    const actorId = context.vars.actorId;

    const message = {
        type: "send",
        context: "xmpp",
        actor: {
            id: actorId,
            type: "person",
        },
        target: {
            id: "testroom@conference.localhost",
            type: "room",
        },
        object: {
            id: `xmpp-${Date.now()}`,
            type: "message",
            content: `XMPP test ${Date.now()}`,
        },
    };

    const startTime = Date.now();

    client.socket.emit("message", message, (response) => {
        const latency = Date.now() - startTime;
        events.emit("histogram", "sockethub.latency.xmpp", latency);

        if (response?.error) {
            events.emit("counter", "sockethub.error.xmpp", 1);
            console.error("XMPP error:", response.error);
            context.vars.errors.push(`XMPP: ${response.error}`);
        } else {
            events.emit("counter", "sockethub.success.xmpp", 1);
        }
        done();
    });
}

/**
 * Send Feed fetch message with error handling
 */
function sendFeedMessage(context, events, done) {
    const client = context.vars.client;
    const actorId = context.vars.actorId;

    const feedUrls = [
        "https://example.com/feed1.xml",
        "https://example.com/feed2.xml",
        "https://example.com/feed3.xml",
    ];

    const message = {
        type: "fetch",
        context: "feeds",
        actor: {
            id: actorId,
            type: "person",
        },
        object: {
            type: "feed",
            id: feedUrls[Math.floor(Math.random() * feedUrls.length)],
        },
    };

    const startTime = Date.now();

    client.socket.emit("message", message, (response) => {
        const latency = Date.now() - startTime;
        events.emit("histogram", "sockethub.latency.feed", latency);

        if (response?.error) {
            events.emit("counter", "sockethub.error.feed", 1);
            console.error("Feed error:", response.error);
            context.vars.errors.push(`Feed: ${response.error}`);
        } else {
            events.emit("counter", "sockethub.success.feed", 1);
        }
        done();
    });
}

/**
 * Disconnect client gracefully
 */
function disconnectClient(context, events, done) {
    if (context.vars.client?.socket) {
        context.vars.client.socket.disconnect();
    }

    // Report if this user had errors
    if (context.vars.errors?.length > 0) {
        events.emit("counter", "sockethub.users_with_errors", 1);
    } else {
        events.emit("counter", "sockethub.users_clean", 1);
    }

    done();
}
