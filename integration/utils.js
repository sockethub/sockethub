/**
 * Test utilities for both Node.js and browser environments
 */

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
