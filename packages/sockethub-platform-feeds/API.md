# Classes

<dl>
<dt><a href="#Feeds">Feeds</a></dt>
<dd><p>Class: Feeds</p>
<p>Handles all actions related to fetching feeds.</p>
<p>Current supported feed types:</p>
<ul>
<li><p>RSS (1 &amp; 2)</p>
</li>
<li><p>Atom</p>
</li>
</ul>
<p>Uses the <code>node-feedparser</code> module as a base tool fetching feeds.</p>
<p><a href="https://github.com/danmactough/node-feedparser">https://github.com/danmactough/node-feedparser</a></p>
</dd>
</dl>

# Constants

<dl>
<dt><a href="#FeedParser">FeedParser</a></dt>
<dd><p>This is a platform for sockethub implementing Atom/RSS fetching functionality.</p>
<p>Developed by Nick Jennings (<a href="https://github.com/silverbucket">https://github.com/silverbucket</a>)</p>
<p>sockethub is licensed under the LGPLv3.
See the LICENSE file for details.</p>
<p>The latest version of this module can be found here:
  git://github.com/sockethub/sockethub-platform-feeds.git</p>
<p>For more information about sockethub visit <a href="http://sockethub.org/">http://sockethub.org/</a>.</p>
<p>This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.</p>
</dd>
</dl>

<a name="Feeds"></a>

# Feeds
Class: Feeds

Handles all actions related to fetching feeds.

Current supported feed types:

- RSS (1 & 2)

- Atom

Uses the `node-feedparser` module as a base tool fetching feeds.

https://github.com/danmactough/node-feedparser

**Kind**: global class  

* [Feeds](#Feeds)
    * [new Feeds(cfg)](#new_Feeds_new)
    * [.fetch(job, credentials, cb)](#Feeds+fetch)

<a name="new_Feeds_new"></a>

## new Feeds(cfg)
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>cfg</td><td><code>object</code></td><td><p>a unique config object for this instance</p>
</td>
    </tr>  </tbody>
</table>

<a name="Feeds+fetch"></a>

## feeds.fetch(job, credentials, cb)
Function: fetch

Fetches feeds from specified source. Upon completion it will send back a
response to the original request with a complete list of URLs in the feed
and total count.

**Kind**: instance method of [<code>Feeds</code>](#Feeds)  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>Activity streams object containing job data.</p>
</td>
    </tr><tr>
    <td>credentials</td><td><code>object</code></td><td></td>
    </tr><tr>
    <td>cb</td><td><code>object</code></td><td></td>
    </tr>  </tbody>
</table>

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
<a name="FeedParser"></a>

# FeedParser
This is a platform for sockethub implementing Atom/RSS fetching functionality.

Developed by Nick Jennings (https://github.com/silverbucket)

sockethub is licensed under the LGPLv3.
See the LICENSE file for details.

The latest version of this module can be found here:
  git://github.com/sockethub/sockethub-platform-feeds.git

For more information about sockethub visit http://sockethub.org/.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

**Kind**: global constant  
