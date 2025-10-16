/**
 * Centralized configuration for Sockethub integration tests
 * Detects Docker environment and provides appropriate configuration values
 */

// Detect if running inside Docker container
function isDockerEnvironment() {
    // In browser environment, assume local development
    if (typeof window !== "undefined") return false;

    // Check for Docker-specific networking
    if (process.env.REDIS_URL?.includes("redis://redis:")) return true;

    return false;
}

const IS_DOCKER = isDockerEnvironment();

// Base configuration
const config = {
    // Sockethub server configuration
    sockethub: {
        port: "10550",
        url: IS_DOCKER ? "http://sockethub:10550" : "http://localhost:10550",
    },

    // Redis configuration
    redis: {
        host: IS_DOCKER ? "redis" : "localhost",
        port: "6379",
        url: IS_DOCKER ? "redis://redis:6379" : "redis://localhost:6379",
    },

    // Prosody XMPP server configuration
    prosody: {
        host: IS_DOCKER ? "prosody" : "localhost",
        port: "5222",
        resource: "SockethubTest",
        testUser: {
            username: "jimmy",
            password: "passw0rd",
            // fullJid: IS_DOCKER ? "jimmy@prosody" : "jimmy@localhost",
        },
        room: "testroom@prosody",
    },

    timeouts: {
        connect: 5000,
        cleanup: 3000,
        message: 2000,
        process: 10000, // starting a process
    },

    // Test configuration
    // test: {
    //     multiClient: {
    //         defaultCount: 3,
    //         baseResource: "SockethubTest",
    //         testRoom: "testroom@prosody",
    //     },
    //     timeouts: {
    //         connection: 3000,
    //         message: 2000,
    //         wait: 200,
    //     },
    // },
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
