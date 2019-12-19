<a name="Feeds"></a>

## Feeds
**Kind**: global class  

* [Feeds](#Feeds)
    * [new Feeds(Sockethub)](#new_Feeds_new)
    * [.fetch(object})](#Feeds+fetch)

<a name="new_Feeds_new"></a>

### new Feeds(Sockethub)
Class: Feeds

Handles all actions related to fetching feeds.

Current supported feed types:

- RSS (1 & 2)

- Atom

Uses the `node-feedparser` module as a base tool fetching feeds.

https://github.com/danmactough/node-feedparser


| Param | Type | Description |
| --- | --- | --- |
| Sockethub | <code>object</code> | session object |

<a name="Feeds+fetch"></a>

### feeds.fetch(object})
Function: fetch

Fetches feeds from specified source. Upon completion it will send back a 
response to the original request with a complete list of URLs in the feed 
and total count.

**Kind**: instance method of [<code>Feeds</code>](#Feeds)  

| Param | Type | Description |
| --- | --- | --- |
| object} | <code>object</code> | Activity streams object containing job data. |

**Example**  
```js
{
   context: "feeds",
   '@type': "fetch",
   actor: {
     '@id': 'https://dogfeed.com/user/nick@silverbucket',
     '@type': "person",
     displayName: "nick@silverbucket.net"
   },
   target: {
     '@id': 'http://blog.example.com/rss',
     '@type': "feed"
   },
   object: {
     '@type': "parameters",
     limit: 10,    // default 10
     property: 'date'
     after: 'Tue Nov 26 2013 02:11:59 GMT+0100 (CET)',

     // ... OR ...

     property: 'link',
     after: 'http://www.news.com/articles/man-eats-car',
   }
 }


 // Without any parameters specified, the platform will return most
 // recent 10 articles fetched from the feed.

 // Example of the resulting JSON AS Object:
 
  {
    context: 'feeds',
    '@type': 'post',
    actor: {
      '@type': 'feed',
      displayName: 'Best Feed Inc.',
      '@id': 'http://blog.example.com/rss',
      description: 'Where the best feed comes to be the best',
      image: {
        width: '144',
        height: '144',
        url: 'http://example.com/images/bestfeed.jpg',
      }
      favicon: 'http://example.com/favicon.ico',
      categories: ['best', 'feed', 'aminals'],
      language: 'en',
      author: 'John Doe'
    },
    target: {
      '@id': 'https://dogfeed.com/user/nick@silverbucket',
      '@type': "person",
      displayName: "nick@silverbucket.net"
    },
    object: {
      '@id': "http://example.com/articles/about-stuff"
      '@type': 'post',
      title: 'About stuff...',
      url: "http://example.com/articles/about-stuff"
      date: "2013-05-28T12:00:00.000Z",
      datenum: 1369742400000,
      brief_html: "Brief synopsis of stuff...",
      brief_text: "Brief synopsis of stuff...",
      html: "Once upon a time...",
      text: "Once upon a time..."
      media: [
        {
          length: '13908973',
          type: 'audio/mpeg',
          url: 'http://example.com/media/thing.mpg'
        }
      ]
      tags: ['foo', 'bar']
    }
  }
```
