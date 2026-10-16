/**
 * Artillery processor using @sockethub/client
 * This ensures proper ActivityStreams formatting and error handling
 */

// CommonJS imports (Artillery runs in Node.js)
const SockethubClient = require("@sockethub/client").default;
const { io } = require("socket.io-client");

function contextFor(platform) {
    return [
        "https://www.w3.org/ns/activitystreams",
        "https://sockethub.org/ns/context/v1.jsonld",
        `https://sockethub.org/ns/context/platform/${platform}/v1.jsonld`,
    ];
}

// Circuit breaker - abort test if Sockethub becomes unavailable
const MAX_CONSECUTIVE_FAILURES = 10; // Consecutive failures before triggering circuit breaker
const ALERT_INTERVAL_MS = 5000; // Alert every 5 seconds when circuit breaker is open
const DEFAULT_RESPONSE_TIMEOUT_MS = 3000;

let consecutiveConnectionFailures = 0;
let circuitBreakerTriggered = false;
let lastAlertTime = 0;
let lastSuccessTime = Date.now();

function recordSuccess() {
    consecutiveConnectionFailures = 0;
    lastSuccessTime = Date.now();
}

function recordFailure() {
    consecutiveConnectionFailures++;
}

function emitWithTimeout(socket, event, payload, timeoutMs, onResponse) {
    let finished = false;
    const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        onResponse(new Error(`${event} response timeout`), null);
    }, timeoutMs);

    socket.emit(event, payload, (response) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        onResponse(null, response);
    });
}

module.exports = {
    setupClient,
    sendCredentials,
    sendDummyEcho,
    setupXMPP,
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

    if (
        consecutiveConnectionFailures >= MAX_CONSECUTIVE_FAILURES &&
        !circuitBreakerTriggered
    ) {
        circuitBreakerTriggered = true;
        const downtime = Math.round((Date.now() - lastSuccessTime) / 1000);
        console.error(
            `\n🛑 CIRCUIT BREAKER TRIGGERED: ${consecutiveConnectionFailures} consecutive failures.\n   Sockethub has been down for ~${downtime}s\n   Aborting new connections. Press Ctrl+C to stop the test.\n`,
        );
        lastAlertTime = Date.now();
        events.emit("counter", "sockethub.circuit_breaker", 1);
        return done(
            new Error("Circuit breaker triggered - server unavailable"),
        );
    }

    const connectionStarted = Date.now();
    const socket = io(process.env.SOCKETHUB_URL || context.vars.target, {
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
        events.emit(
            "histogram",
            "sockethub.latency.connection",
            Date.now() - connectionStarted,
        );
        context.vars.connected = true;
        recordSuccess();
    });

    socket.on("connect_error", (err) => {
        events.emit("counter", "sockethub.connect_error", 1);
        recordFailure();
        // Only log first few errors
        if (consecutiveConnectionFailures <= 3) {
            console.error(
                `Connection error (${consecutiveConnectionFailures}): ${err.message}`,
            );
        }
        context.vars.errors.push(`Connection: ${err.message}`);
    });

    socket.on("disconnect", (reason) => {
        if (reason === "transport close" || reason === "transport error") {
            recordFailure();
        }
    });

    // Wait for client to be ready (schema initialization) or timeout
    const client = context.vars.client;
    client
        .ready(3000)
        .then(() => {
            context.vars.schemasReady = true;
            done();
        })
        .catch((err) => {
            const reason = err?.message || String(err);
            if (!context.vars.connected) {
                recordFailure();
                if (consecutiveConnectionFailures <= 3) {
                    console.error(
                        `Connection timeout - socket never connected: ${reason}`,
                    );
                }
                events.emit("counter", "sockethub.connect_timeout", 1);
                context.vars.errors.push(`Connection timeout: ${reason}`);
            } else {
                events.emit("counter", "sockethub.schemas_timeout", 1);
                context.vars.errors.push(`Schemas timeout: ${reason}`);
            }
            socket.disconnect();
            done(new Error(reason));
        });
}

/**
 * Send credentials and register actor
 */
function sendCredentials(context, events, done) {
    const client = context.vars.client;
    const actorId = context.vars.actorId;

    // Check if connected and ready
    if (!context.vars.connected || !context.vars.schemasReady) {
        events.emit("counter", "sockethub.error.not_connected", 1);
        console.error(
            "Cannot send credentials - not connected or schemas not ready",
        );
        return done();
    }

    // Send credentials message (uses 'credentials' event, not 'message')
    const credentialsMsg = {
        type: "credentials",
        "@context": contextFor("dummy"),
        actor: {
            id: actorId,
            type: "person",
        },
        object: {
            id: `creds-${context.vars.$uuid}`,
            type: "credentials",
            secret: `test-secret-${context.vars.$uuid}-with-sufficient-entropy`,
        },
    };

    emitWithTimeout(
        client.socket,
        "credentials",
        credentialsMsg,
        DEFAULT_RESPONSE_TIMEOUT_MS,
        (err, response) => {
            if (err) {
                events.emit("counter", "sockethub.error.credentials", 1);
                console.error("Credentials timeout");
                context.vars.errors.push("Credentials: timeout");
                return done();
            }

            if (response?.error) {
                events.emit("counter", "sockethub.error.credentials", 1);
                console.error("Credentials error:", response.error);
                context.vars.errors.push(`Credentials: ${response.error}`);
            } else {
                events.emit("counter", "sockethub.success.credentials", 1);
            }
            done();
        },
    );
}

/**
 * Send Dummy echo message with error handling
 */
function sendDummyEcho(context, events, done) {
    if (!context.vars.connected || !context.vars.schemasReady) {
        events.emit("counter", "sockethub.error.not_ready", 1);
        return done();
    }
    const client = context.vars.client;
    const actorId = context.vars.actorId;

    if (!context.vars.connected) {
        events.emit("counter", "sockethub.error.not_connected", 1);
        console.error("Cannot send echo - not connected");
        return done();
    }

    const message = {
        type: "echo",
        "@context": contextFor("dummy"),
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

    events.emit("counter", "sockethub.attempt.echo", 1);
    const startTime = Date.now();

    emitWithTimeout(
        client.socket,
        "message",
        message,
        DEFAULT_RESPONSE_TIMEOUT_MS,
        (err, response) => {
            const latency = Date.now() - startTime;

            if (err) {
                events.emit("counter", "sockethub.error.echo", 1);
                console.error("Echo timeout");
                context.vars.errors.push("Echo: timeout");
                return done();
            }

            if (response?.error) {
                events.emit("counter", "sockethub.error.echo", 1);
                console.error("Echo error:", response.error);
                context.vars.errors.push(`Echo: ${response.error}`);
            } else {
                events.emit("histogram", "sockethub.latency.echo", latency);
                events.emit("counter", "sockethub.success.echo", 1);
            }
            done();
        },
    );
}

/** Establish a distinct XMPP resource and room nickname for each user. */
async function setupXMPP(context, events, done) {
    const userAddress = process.env.XMPP_USER;
    const password = process.env.XMPP_PASSWORD;
    if (!userAddress || !password) {
        context.vars.client?.socket.disconnect();
        return done(new Error("XMPP_USER and XMPP_PASSWORD are required"));
    }
    const resource = `stress-${context.vars.$uuid}`;
    const actor = {
        id: `${userAddress}/${resource}`,
        type: "person",
        name: resource,
    };
    context.vars.actorId = actor.id;
    const client = context.vars.client;
    const emit = (event, payload) =>
        new Promise((resolve, reject) => {
            emitWithTimeout(
                client.socket,
                event,
                payload,
                10000,
                (err, response) => {
                    if (err || response?.error)
                        reject(err || new Error(response.error));
                    else resolve(response);
                },
            );
        });
    try {
        await emit("credentials", {
            type: "credentials",
            "@context": contextFor("xmpp"),
            actor,
            object: {
                type: "credentials",
                userAddress,
                password,
                resource,
                server: process.env.XMPP_SERVER || "xmpp://localhost:5222",
                port: Number(process.env.XMPP_PORT || 5222),
            },
        });
        await emit("message", {
            type: "connect",
            "@context": contextFor("xmpp"),
            actor,
        });
        await emit("message", {
            type: "join",
            "@context": contextFor("xmpp"),
            actor,
            target: {
                id: process.env.XMPP_ROOM || "testroom@conference.prosody",
                type: "room",
            },
        });
        done();
    } catch {
        events.emit("counter", "sockethub.error.xmpp_setup", 1);
        context.vars.errors.push("XMPP setup failed");
        client.socket.disconnect();
        done(new Error("XMPP setup failed; check server logs"));
    }
}

/**
 * Send XMPP message with error handling
 */
function sendXMPPMessage(context, events, done) {
    if (!context.vars.connected || !context.vars.schemasReady) {
        events.emit("counter", "sockethub.error.not_ready", 1);
        return done();
    }
    const client = context.vars.client;
    const actorId = context.vars.actorId;

    if (!context.vars.connected) {
        events.emit("counter", "sockethub.error.not_connected", 1);
        console.error("Cannot send XMPP - not connected");
        return done();
    }

    const message = {
        type: "send",
        "@context": contextFor("xmpp"),
        actor: {
            id: actorId,
            type: "person",
        },
        target: {
            id: process.env.XMPP_ROOM || "testroom@conference.prosody",
            type: "room",
        },
        object: {
            id: `xmpp-${Date.now()}`,
            type: "message",
            content: `XMPP test ${Date.now()}`,
        },
    };

    events.emit("counter", "sockethub.attempt.xmpp", 1);
    const startTime = Date.now();

    emitWithTimeout(
        client.socket,
        "message",
        message,
        DEFAULT_RESPONSE_TIMEOUT_MS,
        (err, response) => {
            const latency = Date.now() - startTime;

            if (err) {
                events.emit("counter", "sockethub.error.xmpp", 1);
                console.error("XMPP timeout");
                context.vars.errors.push("XMPP: timeout");
                return done();
            }

            if (response?.error) {
                events.emit("counter", "sockethub.error.xmpp", 1);
                console.error("XMPP error:", response.error);
                context.vars.errors.push(`XMPP: ${response.error}`);
            } else {
                events.emit("histogram", "sockethub.latency.xmpp", latency);
                events.emit("counter", "sockethub.success.xmpp", 1);
            }
            done();
        },
    );
}

/**
 * Send Feed fetch message with error handling
 */
function sendFeedMessage(context, events, done) {
    if (!context.vars.connected || !context.vars.schemasReady) {
        events.emit("counter", "sockethub.error.not_ready", 1);
        return done();
    }
    const client = context.vars.client;

    if (!context.vars.connected) {
        events.emit("counter", "sockethub.error.not_connected", 1);
        console.error("Cannot send feed - not connected");
        return done();
    }

    if (!process.env.FEED_URL) {
        client.socket.disconnect();
        return done(
            new Error("FEED_URL must point to a benchmark feed fixture"),
        );
    }
    const message = {
        type: "fetch",
        "@context": contextFor("feeds"),
        actor: { id: process.env.FEED_URL, type: "feed" },
    };

    events.emit("counter", "sockethub.attempt.feed", 1);
    const startTime = Date.now();

    emitWithTimeout(
        client.socket,
        "message",
        message,
        DEFAULT_RESPONSE_TIMEOUT_MS,
        (err, response) => {
            const latency = Date.now() - startTime;

            if (err) {
                events.emit("counter", "sockethub.error.feed", 1);
                console.error("Feed timeout");
                context.vars.errors.push("Feed: timeout");
                return done();
            }

            if (response?.error) {
                events.emit("counter", "sockethub.error.feed", 1);
                console.error("Feed error:", response.error);
                context.vars.errors.push(`Feed: ${response.error}`);
            } else {
                events.emit("histogram", "sockethub.latency.feed", latency);
                events.emit("counter", "sockethub.success.feed", 1);
            }
            done();
        },
    );
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
