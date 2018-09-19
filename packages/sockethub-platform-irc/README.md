# sockethub-platform-irc

A sockethub platform module implementing IRC functionality.

[![Build Status](http://img.shields.io/travis/sockethub/sockethub-platform-irc.svg?style=flat)](https://travis-ci.org/sockethub/sockethub-platform-irc)
[![Dependency Status](http://img.shields.io/david/sockethub/sockethub-platform-irc.svg?style=flat)](https://david-dm.org/sockethub/sockethub-platform-irc#info=dependencies)
[![devDependency Status](http://img.shields.io/david/dev/sockethub/sockethub-platform-irc.svg?style=flat)](https://david-dm.org/sockethub/sockethub-platform-irc#info=devDependencies)
[![Code Climate](http://img.shields.io/codeclimate/github/sockethub/sockethub-platform-irc.svg?style=flat)](https://codeclimate.com/github/sockethub/sockethub-platform-irc)
[![License](https://img.shields.io/npm/l/sockethub-platform-irc.svg?style=flat)](https://raw.githubusercontent.com/sockethub/sockethub-platform-irc/master/LICENSE)
[![Release](http://img.shields.io/github/release/sockethub/sockethub-platform-irc.svg?style=flat)](https://github.com/sockethub/sockethub-platform-irc/releases)

[![Flattr this](http://api.flattr.com/button/flattr-badge-large.png)](http://flattr.com/thing/1154379/Sockethub)

## About

This module contains all of the implementation details of an IRC client and is
used as a sockethub platform.

Each sockethub platform uses JSON Activity Streams 2.0 which are recevied from and sent to clients, through the Sockethub service.

## Object Formats

### Connected to IRC

```json
{
  "@type": "announce",
  "context": "irc",
  "actor": {
    "@id": "irc://irc.freenode.net",
    "@type": "service"
  },
  "published": "2015-05-20T22:32:06.212Z",
  "target": {
    "@id": "irc://foobar@irc.freenode.net",
    "@type": "person",
    "displayName": "Foobar McUser"
  },
  "object": {
    "@type": "content",
    "content": {
      "network":{
         "name":"freenode",
         "hostname":"orwell.freenode.net",
         "ircd":"ircd-seven-1.1.3",
         "nicklength":16,
         "maxtargets":{
            "NAMES":1,
            "LIST":1,
            "KICK":1,
            "WHOIS":1,
            "PRIVMSG":4,
            "NOTICE":4,
            "ACCEPT":0,
            "MONITOR":0
         }
      },
      "channel":{
         "idlength":{

         },
         "limit":{
            "#":120
         },
         "length":50,
         "modes":4,
         "types":"#",
         "kicklength":0,
         "topiclength":390
      },
      "modes":{
         "user":"DOQRSZaghilopswz",
         "channel":"CFILMPQSbcefgijklmnopqrstvz",
         "param":"bkloveqjfI",
         "types":{
            "a":"eIbq",
            "b":"kov",
            "c":"flj",
            "d":"CFLMPQScgimnprstz"
         },
         "prefixes":"@+",
         "prefixmodes":{
            "o":"@",
            "v":"+"
         },
         "maxlist":{
            "bqeI":100
         }
      }
    }
  }
}
```

## API

API docs can be found [here](API.md)
