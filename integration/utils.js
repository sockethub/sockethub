/**
 * Test utilities for both Node.js and browser environments
 */

export default function createTestUtils(config) {
    return {
        /**
         * Create XMPP JID
         * @param {string|null} resource - optional client resource
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
                name: jid.split("/")[1] || config.prosody.testUser.username,
            };
        },

        /**
         * Create IRC actor ID (nick@server).
         * The name portion must be a bare IRC token — platform-irc sends
         * `PING ${actor.name}` to drive its job queue, so spaces or non-IRC
         * characters will break jobs.
         * @param {string} nick - IRC nickname (must be a valid IRC token)
         * @returns {string} Generated IRC actor ID
         */
        createIrcActorId(nick = config.irc.testUser.nick) {
            return `${nick}@${config.irc.host}`;
        },

        /**
         * Create IRC actor object. `name` must equal the nick exactly.
         * @param {string} nick - IRC nickname
         * @returns {object} Actor object
         */
        createIrcActorObject(nick = config.irc.testUser.nick) {
            return {
                id: this.createIrcActorId(nick),
                type: "person",
                name: nick,
            };
        },
    };
}
