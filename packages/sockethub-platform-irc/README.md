sockethub-platform-irc
======================

A sockethub platform module implementing IRC functionality.

This module is not yet ready for use, and is intended for future versions of
sockethub. Current IRC functionality already exists in the stand-alone sockethub repository.


# Object Formats
## contected to IRC:

```
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