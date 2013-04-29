# Sockethub architecture overview

Sockethub is an abstraction layer on top of the many different protocols of the web. Although the project is still young and only a small portion of the planned APIs are supported (the logic of which is contained in what are known as *platforms*), the goal is to continue to improve platform coverage over time.

Here is a basic, and generalized, visual of the sockethub architecture.

![architecture overview](http://sockethub.org/img/architecture_overview.svg)

## Components

There are 5 major components of sockethub. The *dispatcher*, the *session* class, the *redis queue*, the *listener* and the *platforms*.

### Dispatcher

### Session

### Redis Queue

### Listener

### Platforms


# Platform support

For starters, the focus is on messaging. Protocols that we'd like to implement in this area are: XMPP, Email (POP, IMAP, SMTP), Facebook, Twitter. We encourage developers to help us build out these platforms (and feel free to contribute other platforms outside of this scope).
