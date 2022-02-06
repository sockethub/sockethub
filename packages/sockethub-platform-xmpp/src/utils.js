
module.exports  = {
  buildXmppCredentials: function (credentials) {
    const [ username, server ] = credentials.object.userAddress.split('@');
    let xmpp_creds = {
      service: credentials.object.server ? credentials.object.server : server ? server : undefined,
      username: username,
      password: credentials.object.password
    };
    if (credentials.object.resource) {
      xmpp_creds.resource = credentials.object.resource;
    }
    return xmpp_creds;
  }
};