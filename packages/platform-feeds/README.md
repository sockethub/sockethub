# @sockethub/platform-feeds

A Sockethub platform module for fetching and parsing RSS and Atom feeds.

## About

This platform fetches RSS and Atom feeds from URLs and converts feed entries into ActivityStreams objects. It handles various feed formats and provides structured data for web applications to consume feed content.

## Implemented Verbs (`@type`)

* **fetch** - Retrieve and parse an RSS or Atom feed

## Usage

### Request Format

```json
{
  "@type": "fetch",
  "context": "feeds",
  "actor": {
    "@id": "https://example.com/feed.xml"
  }
}
```

### Response Format

Returns an ActivityStreams Collection with feed entries:

```json
{
  "@type": "Collection",
  "context": "feeds",
  "totalItems": 10,
  "items": [
    {
      "@type": "Create",
      "actor": {
        "@id": "https://example.com/feed.xml",
        "name": "Example Blog"
      },
      "object": {
        "@type": "Article",
        "name": "Blog Post Title",
        "content": "Post content...",
        "url": "https://example.com/post/1",
        "published": "2023-01-01T12:00:00Z"
      }
    }
  ]
}
```

## Supported Feed Formats

- **RSS 2.0**: Standard RSS feeds
- **Atom 1.0**: Atom syndication format
- **RSS 1.0/RDF**: RDF-based RSS feeds

## Use Cases

- **Content aggregation**: Collect posts from multiple blogs and news sites
- **Feed readers**: Build web-based feed reading applications
- **Content monitoring**: Track updates from RSS/Atom feeds
- **Data integration**: Import feed content into other systems
