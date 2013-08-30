# Sockethub architecture overview

Sockethub is an abstraction layer on top of the many different protocols of the web. Although the project is still young and only a small portion of the planned APIs are supported (the logic of which is contained in what are known as *platforms*), the goal is to continue to improve platform coverage over time.

Here is a basic, and generalized, visual of the sockethub architecture.

![architecture overview](http://sockethub.org/img/architecture_overview.svg)

## Components

There are 5 major components of sockethub. The *dispatcher*, the *session* class, the *redis queue*, the *listener* and the *platforms*.

### Dispatcher

The dispatcher takes incoming JSON objects from the WebSocket server. If a session (session ID) does not already exist it creates one, then it validates the incoming JSON object, sending back any errors to the client. Assuming the object passes validation, the dispatcher then places the object (referred to as 'job') into the redis queue for the appropriate listener (platform).

In addition, there are a few commands which the dispatcher handles directly. At the moment of writing this, the two main dispatcher commands (*verbs*) are `register` and `set`. These commands don't go through the process of normal commands. For the set command, specifically, the data passed in the object is stored in redis for the platform (specified as the target) to retreive when needed. This is commonly used for things like setting credential data that a platform may later need.

***more info*** For details on using sockethub from your web app, using the `register` or `set` commands and more, see [platform_overview.md](platform_overview), and the [sockethub-client repository](https://github.com/sockethub/sockethub-client).

The dispatcher also listens for completed requests on a separate outgoing redis channel for completed jobs. When anything is received here, it will send it to the correct client based on the session ID.

### Session

The session class is what handles all the session data for platforms. It keeps it's data in specially created redis stores based on session ID. Sessions are created by the dispatcher, and passed to the platform via. the listener.

There are two levels of a session object. There is the session object that the "internal" sockethub classes can access (listener and dispatcher) and then there's a sub-object (platform session) which the listener passes to the platform.

This platform session ensures that the platform can only get the platform related data for that session (whereas the internal session object can access data for any platform for that session). The platform can only access this subset of the session which allows it do just do a few things like retreiving config options (which were set for that session/platform by the application via. the 'set' verb), and sending out log messages (pre-formated for that session/platform for clarity in the logs).

### Redis Queue

### Listener

For every platform configured to be used, a listener is instantiated during startup. During initialization of a new session, the listener will initialize the platform by calling it's init() function with the platform session as the parameter.

This listener then waits for jobs for that platform on the redis queue, when they come it, in checks the verb, and passes the job to that verbs function in the platform class. Sending the results back to the dispatcher via the outgoing channel.

### Platforms

The paltforms are the heart of Sockethub. They contain all of the logic, quirks, and protocol specifics of the subject of that platform. For example, the 'email' platform would contain logic for POP, IMAP and SMTP - it's important to note that these protocols are not their own specific platforms, they are all within the email platform because email is the problem domain. If you use a JSON object with the verb ***send***  and the platform ***email***, then the listener will call the email platforms `send()` function.

However, if you were to specify the ***follow*** verb in your JSON object, the listener would then call the email platforms `follow()` function. Basing our JSON objects on [activity streams](http://activitystrea.ms/registry/verbs/), follow is the verb used to describe interest in receiving updates from a subject. In our case, we may specific the target as 'imap' or 'pop' to indicate which aspect of email (platform) we wish to follow.

For more details on the specifics of platforms, see [adding_a_platform.md](adding_a_platform.md)

# Platform support

For starters, the focus is on messaging. Protocols that we'd like to implement in this area are: XMPP, Email (POP, IMAP, SMTP), Facebook, Twitter. We encourage developers to help us build out these platforms (and feel free to contribute other platforms outside of this scope).
