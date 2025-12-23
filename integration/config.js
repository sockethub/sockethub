/**
 * Centralized configuration for Sockethub integration tests
 */

// If sockethub is inside a docker image, the hosts might have unique names
const XMPP_HOST = process.env.XMPP_HOST || "localhost";
const SOCKETHUB_HOST = process.env.SOCKETHUB_HOST || "localhost";
const REDIS_HOST = process.env.REDIS_HOST || "localhost";


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
        process: 5000, // starting a process
    },
};
export default config;
