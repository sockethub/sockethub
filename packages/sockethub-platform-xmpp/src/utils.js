
module.exports  = {
  buildXmppCredentials: function (credentials) {
    const [ username, server ] = credentials.object.username.split('@');
    let xmpp_creds = {
      service: server,
      username: username,
      password: credentials.object.password
    };
    if (credentials.object.resource) {
      xmpp_creds.resource = credentials.object.resource;
    }
    return xmpp_creds;
  }
};