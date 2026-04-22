# @sockethub/platform-feeds

A Sockethub platform module for fetching and parsing RSS and Atom feeds.

## About

This platform fetches RSS and Atom feeds from URLs and converts feed entries into
ActivityStreams objects. It handles various feed formats and provides structured data for
web applications to consume feed content.

## Implemented Verbs (`type`)

* **fetch** - Retrieve and parse an RSS or Atom feed

## Usage

### Request Format

```json
{
  "type": "fetch",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/feeds/v1.jsonld"
  ],
  "actor": {
    "id": "https://example.com/feed.xml",
    "type": "feed"
  }
}
```

### Response Format

Returns an ActivityStreams Collection with feed entries:

```json
{
  "type": "collection",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/feeds/v1.jsonld"
  ],
  "summary": "Example Blog",
  "totalItems": 10,
  "items": [
    {
      "type": "post",
      "@context": [
        "https://www.w3.org/ns/activitystreams",
        "https://sockethub.org/ns/context/v1.jsonld",
        "https://sockethub.org/ns/context/platform/feeds/v1.jsonld"
      ],
      "actor": {
        "id": "https://example.com/feed.xml",
        "type": "feed",
        "name": "Example Blog"
      },
      "object": {
        "id": "https://example.com/post/1",
        "type": "article",
        "title": "Blog Post Title",
        "content": "Post content...",
        "url": "https://example.com/post/1",
        "published": "2023-01-01T12:00:00Z"
      }
    }
  ]
}
```

### Detailed Response Example

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/feeds/v1.jsonld"
  ],
  "type": "collection",
  "summary": "Best Feed Inc.",
  "totalItems": 10,
  "items": [
    {
      "@context": [
        "https://www.w3.org/ns/activitystreams",
        "https://sockethub.org/ns/context/v1.jsonld",
        "https://sockethub.org/ns/context/platform/feeds/v1.jsonld"
      ],
      "type": "post",
      "actor": {
        "type": "feed",
        "name": "Best Feed Inc.",
        "id": "http://blog.example.com/rss",
        "description": "Where the best feed comes to be the best",
        "image": {
          "width": "144",
          "height": "144",
          "url": "http://blog.example.com/images/bestfeed.jpg"
        },
        "favicon": "http://blog.example.com/favicon.ico",
        "link": "http://blog.example.com",
        "categories": ["best", "feed", "animals"],
        "language": "en",
        "author": "John Doe"
      },
      "object": {
        "id": "http://blog.example.com/articles/about-stuff",
        "type": "article",
        "title": "About stuff...",
        "url": "http://blog.example.com/articles/about-stuff",
        "date": "2013-05-28T12:00:00.000Z",
        "datenum": 1369742400000,
        "brief": "Brief synopsis of stuff...",
        "content": "Once upon a time...",
        "contentType": "text",
        "media": [
          {
            "length": "13908973",
            "type": "audio/mpeg",
            "url": "http://blog.example.com/media/thing.mpg"
          }
        ],
        "tags": ["foo", "bar"]
      }
    }
  ]
}
```

## Supported Feed Formats

* **RSS 2.0**: Standard RSS feeds
* **Atom 1.0**: Atom syndication format
* **RSS 1.0/RDF**: RDF-based RSS feeds

## Use Cases

* **Content aggregation**: Collect posts from multiple blogs and news sites
* **Feed readers**: Build web-based feed reading applications
* **Content monitoring**: Track updates from RSS/Atom feeds
* **Data integration**: Import feed content into other systems
