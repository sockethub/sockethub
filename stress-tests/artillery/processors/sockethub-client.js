/**
 * Artillery processor using @sockethub/client
 * This ensures proper ActivityStreams formatting and error handling
 */

// Import at module level (Artillery processors run in Node.js)
import SockethubClient from "@sockethub/client";
import { io } from "socket.io-client";

export default {
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
    const socket = io("http://localhost:10550", {
        path: "/sockethub",
        transports: ["websocket"],
    });

    context.vars.client = new SockethubClient(socket);
    context.vars.actorId = `test-${context.vars.$uuid}@dummy`;
    context.vars.errors = [];

    // Track connection
    socket.on("connect", () => {
        events.emit("counter", "sockethub.connected", 1);
    });

    socket.on("connect_error", (err) => {
        events.emit("counter", "sockethub.connect_error", 1);
        console.error("Connection error:", err.message);
    });

    // Give socket time to connect
    setTimeout(done, 100);
}

/**
 * Send credentials and register actor
 */
function sendCredentials(context, events, done) {
    const client = context.vars.client;
    const actorId = context.vars.actorId;

    // Create actor object using client's ActivityStreams API
    const actor = client.ActivityStreams.Object.create({
        id: actorId,
        type: "person",
        name: `Test User ${context.vars.$uuid}`,
    });

    // Send credentials message
    const credentialsMsg = {
        type: "credentials",
        context: "dummy",
        actor: actorId,
        object: {
            type: "credentials",
            secret: "test-secret",
        },
    };

    client.socket.emit("message", credentialsMsg, (response) => {
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
        actor: actorId,
        object: {
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
        actor: actorId,
        target: "testroom@conference.localhost",
        object: {
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
        actor: actorId,
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
