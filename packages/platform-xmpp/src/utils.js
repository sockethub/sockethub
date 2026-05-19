export const utils = {
    buildXmppCredentials: (credentials) => {
        const userAddress = credentials.object.userAddress;
        if (typeof userAddress !== "string" || !userAddress.includes("@")) {
            throw new Error(
                "xmpp credentials.object.userAddress must be a JID in the form 'user@server'",
            );
        }
        const [username, server] = userAddress.split("@");
        if (!username || !server) {
            throw new Error(
                "xmpp credentials.object.userAddress is missing the username or server portion",
            );
        }
        const xmpp_creds = {
            service: credentials.object.server
                ? credentials.object.server
                : server,
            username: username,
            password: credentials.object.password,
        };
        if (credentials.object.port) {
            xmpp_creds.service = `${xmpp_creds.service}:${credentials.object.port}`;
        }
        if (credentials.object.resource) {
            xmpp_creds.resource = credentials.object.resource;
        }
        return xmpp_creds;
    },
};
