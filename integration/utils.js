/**
 * Test utilities for both Node.js and browser environments
 */

export default function createTestUtils(config) {
    return {
        /**
         * Create XMPP JID
         @param {string|null} resource - optional client resource
         * @returns {string} Generated XMPP JID
         */
        createXmppJid(resource = config.prosody.resource) {
            return `${config.prosody.testUser.username}@${config.prosody.host}/${resource}`;
        },

        /**
         * Create actor object from config and client ID
         * @param {string|null} jid - optional client jid
         * @returns {object} Actor object
         */
        createActorObject(jid = this.createXmppJid(config.prosody.resource)) {
            return {
                id: jid,
                type: "person",
                name: `${config.prosody.testUser.username} ${jid}`,
            };
        },
    };
}
