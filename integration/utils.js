/**
 * Test utilities for both Node.js and browser environments
 */

/**
 * Parse configuration from query parameters (browser environment)
 * @returns {object} Parsed configuration object
 */
export function parseConfigFromQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const config = {};
    
    // Reconstruct nested config object from flattened query parameters
    for (const [key, value] of params.entries()) {
        const keys = key.split(".");
        let current = config;
        
        // Navigate/create nested structure
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        // Set the final value with type conversion
        const finalKey = keys[keys.length - 1];
        if (value === "true") {
            current[finalKey] = true;
        } else if (value === "false") {
            current[finalKey] = false;
        } else if (!Number.isNaN(Number(value)) && value !== "") {
            current[finalKey] = Number(value);
        } else {
            current[finalKey] = value;
        }
    }
    
    return config;
}

export default function createTestUtils(config) {
    return {

        /**
         * Create XMPP JID from config and optional client ID
         * @param {string|null} clientId - Optional client ID suffix
         * @returns {string} Generated XMPP JID
         */
        createXmppJid(clientId = null) {
            const resource = `${config.prosody?.resource || "SockethubTest"}${clientId ? clientId : ""}`;
            return `${config.prosody?.testUser?.username}@${config.prosody?.host}/${resource}`;
        },

        /**
         * Create actor object from config and client ID
         * @param {string} clientId - Client ID
         * @param {string|null} name - Optional name override
         * @returns {object} Actor object
         */
        createActorObject(clientId, name = null) {
            const actorId = this.createXmppJid(clientId);
            return {
                id: actorId,
                type: "person",
                name: name || `Jimmy Session ${clientId}`,
            };
        },
    };
}