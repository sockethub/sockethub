

# Adding a platform

A platform is a module that gives sockethub access to one or more APIs or Protocols relating to a specific topic.

For instance, some platforms we're working on are `xmpp`, `email` (which implements smtp, pop and imap, and are all part of the same topic), `facebook`, and `twitter`. It can be unclear whether something is a platform. For instance, would webfinger count as a platform? How about the fact that most things use HTTP, but it wouldn't make sense to have an HTTP platform?

When in doubt, come to the irc channel (#sockethub on irc.freenode.net), or open a github issue about it on [github.com/sockethub/sockethub/issues](https://github.com/sockethub/sockethub/issues/).


## What is a platform?

A platform is a node module which exposes a number of "verbs" (functions) which are actions requested by the user, sockethub validates the request against the schema files (in `lib/schemas/*.js`) and then calls the platforms' function with the corresponding verb specified by the user.

Here are the files you'll need to add or update to add a platform:

### Platform module
First, of course, you'll want to actually write the platform.

    lib/platforms/<platform_name>.js

This is the actual platform file which exposes the functions that the sockethub listener calls. It contains all the logic and functionality to carry out. This *is* the platform

### Platforms schema registry
Then you'll want to update the platforms schema to include your newly created platform

    lib/schemas/platforms.js

When you've added a platform to the `lib/platforms/` directory, next you'll want to add it to the list of platforms in the `lib/schemas/platforms.js`. One entry for each platform along with a list of verb names it implements.


# Adding a verb

Verbs are like commands. A lot of verbs already exist, but you may find that your platform needs a verb that doesn't. We try to follow ActivityStreams verbs as much as possible, but if no ActivityStreams verb exists for the command you need, then just invent a new name for it. Do try to make the verbs platform-independent. For instance, 'endorse' may be a better verb than 'retweet', because it abstracts from the Twitter platform for which you may be needing it.

Places to add your verb:

### Verbs schema registry
If your platform implements a previously undefined verb, you'll need to add that verb to the verbs schema registry.

If your platform has not implemented any new verbs, you can skip this step.

    lib/schemas/verbs.js

If you need a new verb that hasn't been defined yet, you'll want to add it here, along with any types of properties that can be passed to it. The dispatcher automatically runs the JSON Schema Validator on all incoming JSON objects, so the `verbs.js` and `platforms.js` will need to be correct and up to date.



# Config
When you are ready to test your platform, you'll need to add it to the list in the config.js PLATFORMS variable.

    config.js


# Additional notes

### Listening on ports

For some platforms you just want to connect to some API as a client, but for others you may want your server to listen on some port. The way to do this is *not* to make your sockethub platform open a port. Instead, run a server (like a mailserver, or an xmpp server), possibly on the same machine, and let your sockethub platform implement a client for that server. The reason for this design decision is that it allows sockethub to be run on machines that do not expose a public IP address.

### Running as a bot

You may want for instance the 'irc' platform to implement an irc bot, that keeps running even if the user doesn't have a session open. We decided against this. The reason is that it is much easier to manage only transient sessions, and for most platforms, this is enough. Also, having only transient sessions and no persistent ones reduces the risk of user lock-in. This means you will probably have to run more services in concert with your sockethub instance (like maybe an irc logger bot, or a pubsubhubbub instance.
