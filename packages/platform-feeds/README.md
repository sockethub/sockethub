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

#### Optional Fetch Parameters

A fetch request may carry an `object` with filtering parameters. The `object`
is strictly validated: only the parameters below are accepted, anything else
is rejected.

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
  },
  "object": {
    "since": "2024-01-01T00:00:00.000Z",
    "limit": 10
  }
}
```

* **since** (RFC3339 `date-time` string) — only return entries published at or
  after this instant. Entries without a parseable publication date are
  excluded when `since` is set, since they cannot be confirmed as recent
  enough.
* **limit** (integer, minimum `1`) — return at most this many entries. Applied
  after `since`, preserving feed order.

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
        "type": "note",
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
        "image": "http://blog.example.com/images/bestfeed.jpg",
        "link": "http://blog.example.com",
        "categories": ["best", "feed", "animals"],
        "language": "en",
        "author": "John Doe"
      },
      "object": {
        "id": "http://blog.example.com/articles/about-stuff",
        "type": "note",
        "title": "About stuff...",
        "url": "http://blog.example.com/articles/about-stuff",
        "published": "2013-05-28T12:00:00.000Z",
        "datenum": 1369742400000,
        "brief": "Brief synopsis of stuff...",
        "content": "Once upon a time...",
        "contentType": "text"
      }
    }
  ]
}
```

## Request Hardening (SSRF Guard)

Because the server fetches whatever URL a client supplies as `actor.id`, feed
requests are hardened against server-side request forgery (SSRF) and resource
exhaustion:

* Only `http:` and `https:` URLs are accepted.
* The destination hostname is resolved and the request is rejected if any
  resolved address (or an IP literal in the URL) is loopback, private,
  link-local, carrier-grade NAT, or otherwise non-public. IPv4-mapped,
  IPv4-compatible, and NAT64 IPv6 spellings of those ranges are normalized
  and blocked as well.
* Redirects are followed manually with a bounded hop count, and every hop is
  re-validated before being fetched.
* Response bodies are capped at 5 MiB, enforced while streaming (a missing or
  lying `Content-Length` does not bypass the cap).
* Non-2xx responses fail the job with a descriptive error.

### `allowPrivateAddresses`

Set in the Sockethub config file under this platform's `packageConfig` entry:

```json
{
  "packageConfig": {
    "@sockethub/platform-feeds": {
      "allowPrivateAddresses": true
    }
  }
}
```

This disables **only** the private/loopback destination checks. Scheme
validation, the redirect limit, and the response size cap always remain in
effect.

This is an escape hatch for development and test harnesses that serve feed
fixtures from `localhost`, or for self-hosted deployments that intentionally
fetch intranet feeds. **Do not enable it on a server that accepts requests
from untrusted clients** — it allows any client to make the server issue HTTP
requests to internal services, including cloud metadata endpoints such as
`169.254.169.254`. It defaults to off; the full guard is active unless
`allowPrivateAddresses` is explicitly `true`.

## Supported Feed Formats

* **RSS 2.0**: Standard RSS feeds
* **Atom 1.0**: Atom syndication format
* **RSS 1.0/RDF**: RDF-based RSS feeds

## Use Cases

* **Content aggregation**: Collect posts from multiple blogs and news sites
* **Feed readers**: Build web-based feed reading applications
* **Content monitoring**: Track updates from RSS/Atom feeds
* **Data integration**: Import feed content into other systems
