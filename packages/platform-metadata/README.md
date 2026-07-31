# @sockethub/platform-metadata

A Sockethub platform module for extracting metadata from web pages using Open Graph scraping.

## About

This platform fetches and extracts metadata from web pages, including Open Graph data,
site information, images, and other structured metadata. It uses the `open-graph-scraper`
library to analyze web pages and return structured data in ActivityStreams format.

## Implemented Verbs (`type`)

* **fetch** - Extract metadata from a web page URL

## Usage

Each Sockethub platform uses JSON Activity Streams 2.0 which are received from and sent
to clients through the Sockethub service.

### Request Format

```json
{
  "type": "fetch",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/metadata/v1.jsonld"
  ],
  "actor": {
    "id": "https://example.com/page-to-analyze",
    "type": "website"
  }
}
```

### Response Format

The platform returns an ActivityStream object with extracted metadata:

```json
{
  "type": "fetch",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/metadata/v1.jsonld"
  ],
  "actor": {
    "id": "https://example.com/page-to-analyze",
    "type": "website",
    "name": "Example Site"
  },
  "object": {
    "type": "page",
    "language": "en_US",
    "title": "Page Title from Open Graph",
    "name": "Site Name",
    "description": "Page description from meta tags",
    "image": [
      {
        "url": "https://example.com/image.jpg",
        "width": 1200,
        "height": 630,
        "type": "image/jpeg"
      }
    ],
    "url": "https://example.com/canonical-url",
    "favicon": "https://example.com/favicon.ico",
    "charset": "utf-8"
  }
}
```

## Extracted Data

The platform extracts the following metadata when available:

* **Open Graph data**: Title, description, images, site name, URL, locale
* **Site information**: Favicon, character encoding — when a page declares no
  icon, `favicon` falls back to the conventional relative `/favicon.ico` so
  clients can resolve it against the page URL and decorate previews
* **Canonical URLs**: Resolved and canonical page URLs
* **Media**: Images with dimensions and type information; for X/Twitter posts,
  a `video` object (direct media URL, poster `thumbnail`, dimensions, duration)

## Site-Specific Handling

Some large platforms don't expose a post's own media to Open Graph scrapers,
so those URLs are resolved through preview services built for this purpose:

* **X / Twitter status URLs** (`x.com`, `twitter.com`, incl. `/i/web/status/…`)
  are fetched from the [FxTwitter API](https://github.com/FxEmbed/FxEmbed)
  instead of scraped — X serves only a generic site banner to scrapers. The
  response carries the post's text, its actual photo (or video + poster
  thumbnail), and the canonical `x.com` URL. If the API is unavailable or the
  post can't be resolved, the platform falls back to the regular scrape
  (which still yields the post text).
* **Reddit URLs** (`reddit.com` hosts and `redd.it` short links) are scraped
  directly, but with a *compatibility user agent* — Reddit serves its Open
  Graph data (including the post's real preview image) only to recognized
  embed crawlers, and returns a page with no OG tags (or a 403) to anything
  else. See `compatUserAgent` below.
* **Facebook** remains best-effort: post text usually comes through, but
  media requires authentication and no public preview service exists.

### `userAgent`

All outbound requests identify as
`Mozilla/5.0 (compatible; SockethubBot/<version>; +https://sockethub.org)`.
Sites gate scraper-facing behavior on the user agent — preview services serve
their Open Graph payload to bot-like UAs, and many hosts reject undici's
default UA. Override per deployment via `packageConfig`:

```json
{
  "packageConfig": {
    "@sockethub/platform-metadata": {
      "userAgent": "MyDeployment/1.0 (+https://my.example)"
    }
  }
}
```

### `compatUserAgent`

Sites that only serve Open Graph data to *recognized* embed crawlers (Reddit)
are fetched with a link-preview crawler user agent instead — the established
practice for self-hosted preview fetchers. Defaults to
`Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)`;
override via `packageConfig`:

```json
{
  "packageConfig": {
    "@sockethub/platform-metadata": {
      "compatUserAgent": "Mozilla/5.0 (compatible; TelegramBot/1.0)"
    }
  }
}
```

## Dependencies

* **open-graph-scraper**: Core library for extracting Open Graph and metadata from web
  pages

## Request Hardening (SSRF Guard)

Because the server fetches whatever URL a client supplies as `actor.id`, metadata
requests are hardened against server-side request forgery (SSRF) and resource
exhaustion. The fetch runs through a guarded connection layer that:

* refuses to connect to loopback, private, link-local, carrier-grade NAT, or
  cloud-metadata addresses (e.g. `169.254.169.254`), in every IPv4/IPv6 spelling,
  validated at connection time so it also covers redirect hops;
* caps the response body size.

### `allowPrivateAddresses`

Set in the Sockethub config file under this platform's `packageConfig` entry:

```json
{
  "packageConfig": {
    "@sockethub/platform-metadata": {
      "allowPrivateAddresses": true
    }
  }
}
```

This disables **only** the private/loopback destination checks. **Do not enable
it on a server that accepts requests from untrusted clients** — it lets any
client make the server issue requests to internal services. It defaults to off;
it is an escape hatch for dev/test harnesses serving fixtures from `localhost`,
or self-hosted deployments that intentionally fetch intranet pages.

## Error Handling

If metadata extraction fails (invalid URL, network issues, parsing errors, or a
blocked destination), the platform returns an error through the standard
Sockethub error handling mechanism.

## Use Cases

* **Link previews**: Generate rich previews for shared URLs
* **Content analysis**: Extract structured data from web pages
* **Social media integration**: Get Open Graph data for social sharing
* **Web scraping**: Collect metadata from multiple pages
* **SEO analysis**: Analyze page metadata and structure
