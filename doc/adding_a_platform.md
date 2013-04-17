

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
