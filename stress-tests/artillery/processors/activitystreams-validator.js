/**
 * Artillery processor for ActivityStreams message generation and validation
 * This runs in the Artillery process (client-side), not in Sockethub
 */

module.exports = {
    generateConnectMessage,
    generateDummyEchoMessage,
    generateXMPPMessage,
    generateFeedMessage,
    validateResponse,
    trackLatency,
};

/**
 * Generate Socket.IO connect credentials message
 */
function generateConnectMessage(context, _events, done) {
    const actorId = `test-${context.vars.$uuid}@dummy`;
    const actor = {
        id: actorId,
        type: "person",
    };
    context.vars.actor = actor;

    context.vars.connectMessage = {
        type: "credentials",
        context: "dummy",
        actor: actor,
        object: {
            type: "credentials",
            secret: "test-secret",
        },
    };
    return done();
}

/**
 * Generate Dummy platform echo message for performance testing
 */
function generateDummyEchoMessage(context, _events, done) {
    context.vars.messageId = `msg-${Date.now()}-${Math.random()}`;
    context.vars.sentTimestamp = Date.now();

    const actor = context.vars.actor || {
        id: `test-${context.vars.$uuid}@dummy`,
        type: "person",
    };

    context.vars.echoMessage = {
        type: "echo",
        context: "dummy",
        actor: actor,
        object: {
            type: "message",
            content: `Test message ${context.vars.messageId}`,
        },
    };
    return done();
}

/**
 * Generate XMPP send message for stress testing
 */
function generateXMPPMessage(context, _events, done) {
    context.vars.messageId = `msg-${Date.now()}-${Math.random()}`;
    context.vars.sentTimestamp = Date.now();

    const actor = context.vars.actor || {
        id: `test-${context.vars.$uuid}@localhost`,
        type: "person",
    };

    context.vars.xmppMessage = {
        type: "send",
        context: "xmpp",
        actor: actor,
        target: {
            id: "testroom@conference.localhost",
            type: "room",
        },
        object: {
            type: "message",
            content: `XMPP test message ${context.vars.messageId}`,
        },
    };
    return done();
}

/**
 * Generate Feed fetch message
 */
function generateFeedMessage(context, _events, done) {
    context.vars.messageId = `msg-${Date.now()}-${Math.random()}`;
    context.vars.sentTimestamp = Date.now();

    const feedUrls = [
        "https://example.com/feed1.xml",
        "https://example.com/feed2.xml",
        "https://example.com/feed3.xml",
    ];

    const actor = context.vars.actor || {
        id: `test-${context.vars.$uuid}@feeds`,
        type: "person",
    };

    context.vars.feedMessage = {
        type: "fetch",
        context: "feeds",
        actor: actor,
        object: {
            type: "feed",
            id: feedUrls[Math.floor(Math.random() * feedUrls.length)],
        },
    };
    return done();
}

/**
 * Validate ActivityStreams response from Sockethub
 */
function validateResponse(context, events, done) {
    const response = context.vars.response;

    if (!response) {
        console.error("No response received");
        events.emit("counter", "stress.validation.no_response", 1);
        return done();
    }

    // Validate basic ActivityStreams structure
    if (!response.type && !response["@type"]) {
        console.error("Response missing type property:", response);
        events.emit("counter", "stress.validation.invalid_type", 1);
        return done();
    }

    // Track successful validation
    events.emit("counter", "stress.validation.success", 1);

    return done();
}

/**
 * Track end-to-end latency
 */
function trackLatency(context, events, done) {
    if (context.vars.sentTimestamp) {
        const latency = Date.now() - context.vars.sentTimestamp;
        events.emit("histogram", "stress.latency.end_to_end", latency);
        context.vars.sentTimestamp = null;
    }
    return done();
}
