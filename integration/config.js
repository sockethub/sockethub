/**
 * Centralized configuration for Sockethub integration tests
 */

// If sockethub is inside a docker image, the hosts might have unique names
XMPP_HOST = process.env.XMPP_HOST || "localhost";
SOCKETHUB_HOST = process.env.SOCKETHUB_HOST || "localhost";
REDIS_HOST = process.env.REDIS_HOST || "localhost";

// Base configuration
const config = {
    // Sockethub server configuration
    sockethub: {
        port: "10550",
        url: `http://${SOCKETHUB_HOST}:10550`,
    },

    // Redis configuration
    redis: {
        host: REDIS_HOST,
        port: "6379",
        url: `redis://${REDIS_HOST}:6379`,
    },

    // Prosody XMPP server configuration
    prosody: {
        host: XMPP_HOST,
        port: "5222",
        resource: "SockethubTest",
        testUser: {
            username: "jimmy",
            password: "passw0rd",
        },
        room: "testroom@conference.prosody",
    },

    timeouts: {
        connect: 5000,
        cleanup: 3000,
        message: 2000,
        process: 10000, // starting a process
    },
};

// Helper functions
config.createXmppJid = (clientId = null) => {
    const resource = `${config.prosody.resource}${clientId ? `${clientId}` : ""}`;
    return `${config.prosody.testUser.username}@${config.prosody.host}/${resource}`;
};

config.createActorObject = (clientId, name = null) => {
    const actorId = config.createXmppJid(clientId);
    return {
        id: actorId,
        type: "person",
        name: name || `Jimmy Session ${clientId}`,
    };
};

// Export configuration for both Node.js and browser environments
if (typeof module !== "undefined" && module.exports) {
    module.exports = config;
} else if (typeof window !== "undefined") {
    window.SH_CONFIG = config;
}
