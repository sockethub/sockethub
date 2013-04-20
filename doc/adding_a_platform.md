

### adding a platform

A platform is a module that gives sockethub access to a "world", for instance the xmpp world, the smtp world, the facebook world, etcetera. It can be unclear whether something is a platform. For instance, would webfinger count as a platform? When in doubt, come to the irc channel (#sockethub on freenode), open a github issue about it on [gh:sockethub/sockethub](https://github.com/sockethub/sockethub/issues/), or ask your question in [unhosted@googlegroups](https://groups.google.com/forum#!forum/unhosted).

Places to add your platform:

    lib/protocols/sockethub/platforms/<platform>.js
    lib/protocols/sockethub/protocol.js, module.exports.platforms (also specify which verbs your platform will implement)
    config.js
    config.js.template

### adding a verb

Verbs are like commands. A lot of verbs already exist, but you may find that your platform needs a verb that doesn't. We try to follow ActivityStreams verbs as much as possible, but if no ActivityStreams verb exists for the command you need, then just invent a new name for it. Do try to make the verbs platform-independent. For instance, 'endorse' may be a better verb than 'retweet', because it abstracts from the Twitter platform for which you may be needing it.

Places to add your verb:

    lib/protocols/sockethub/verbs_schema.js
    lib/protocols/sockethub/protocol.js, module.exports.verbs
    lib/protocols/sockethub/protocol.js, module.exports.platforms (for each platform that will implement the new verb)
    lib/protocols/sockethub/platforms/*.js (add the o.<verb> function to actually implement it)

### listening on ports

For some platforms you just want to connect to some API as a client, but for others you may want your server to listen on some port. The way to do this is *not* to make your sockethub platform open a port. Instead, run a server (like a mailserver, or an xmpp server), possibly on the same machine, and let your sockethub platform implement a client for that server. The reason for this design decision is that it allows sockethub to be run on machines that do not expose a public IP address.

### running as a bot

You may want for instance the 'irc' platform to implement an irc bot, that keeps running even if the user doesn't have a session open. We decided against this. The reason is that it is much easier to manage only transient sessions, and for most platforms, this is enough. Also, having only transient sessions and no persistent ones reduces the risk of user lock-in. This means you will probably have to run more services in concert with your sockethub instance (like maybe an irc logger bot, or a pubsubhubbub instance.
