# `@sockethub/platform-media`

Media downloads for browser clients. A browser can display an image from
another origin, but it can only read the bytes when that host sends CORS
headers, so it cannot store a copy. `download` fetches the image on the
client's behalf and returns its bytes. This is a stateless platform with no
credentials.

Only images are supported for now. The bytes come back in a single message,
which suits images but not large audio or video; streaming those is tracked in
[#1411](https://github.com/sockethub/sockethub/issues/1411).

Pair it with the [metadata platform](../platform-metadata/README.md): `fetch`
a link's preview, then `download` its image or favicon to keep a copy that
doesn't depend on the origin staying up.

## Setup

The Sockethub CLI bundles this platform and loads it by default. For a custom
server installation, install `@sockethub/platform-media` and include it in
your config's `platforms` list. Remove it from `platforms` to turn downloads
off.

## Usage

```json
{
  "type": "download",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/media/v1.jsonld"
  ],
  "actor": { "id": "https://example.com/article", "type": "website" },
  "object": { "type": "image", "url": "https://cdn.example.com/hero.jpg" }
}
```

`actor.id` is the page that references the image. `object.url` may be
relative to it, so the `/favicon.ico` fallback from a metadata `fetch` can be
passed as is. The page's origin is sent as `Referer`, as a browser would send
it.

The response replaces `object` with the image:

```json
{
  "type": "image",
  "url": "https://cdn.example.com/hero.jpg",
  "mediaType": "image/jpeg",
  "size": 48213,
  "data": "/9j/4AAQSkZJRgABAQ..."
}
```

`url` is the final URL after redirects and `data` is the base64-encoded
bytes. `mediaType` comes from the bytes themselves, not the origin's
`Content-Type` header. AVIF, GIF, ICO, JPEG, PNG, SVG and WebP are
recognized. Render SVG through `<img>` or a blob URL, not inline, since it can
contain script.

Requests go through the same guard as the metadata platform, so private and
internal addresses are refused unless `allowPrivateAddresses` is set. Client
traffic is limited by the server's `rateLimiter` settings, like any other
message.

On failure, the error reads `image download failed (<code>) for <url>:
<detail>`, where `<code>` is one of:

| Code | Meaning |
|---|---|
| `invalid-url` | The URL does not parse or is not `http(s)` |
| `not-found` | The origin answered 404 or 410 |
| `origin-refused` | The origin answered 401, 403, 429 or 451, often a bot block |
| `origin-error` | Any other non-2xx answer |
| `timeout` | No complete response within `timeoutMs` |
| `too-large` | The image is over `maxBytes` |
| `not-image` | The bytes are not an allowed image type, e.g. a block page sent as a 200 |
| `fetch-failed` | A network failure, including a refused private address |

## Configuration

Operators can narrow downloads under `packageConfig`:

```json
{
  "packageConfig": {
    "@sockethub/platform-media": {
      "maxBytes": 10485760,
      "concurrency": 3,
      "timeoutMs": 12000,
      "types": ["avif", "gif", "ico", "jpeg", "png", "svg", "webp"]
    }
  }
}
```

* `maxBytes` (default 10 MiB, at most 25 MiB): larger images fail with
  `too-large`. The body is read only up to the limit. Base64 adds a third, so
  a 10 MiB image is about 13.3 MiB on the wire.
* `concurrency` (default 3): downloads running at once across all clients.
  Later ones wait in the platform's queue. Peak memory in the platform is
  roughly `concurrency × maxBytes × 2.5`, about 75 MB with the defaults.
* `timeoutMs` (default 12000): time allowed for one download, response and
  body together.
* `types` (default all seven): image types that may be returned, matched
  against the file's bytes rather than its URL extension.
* `userAgent`: sent with every request. Defaults to `SockethubBot`.
* `allowPrivateAddresses` (default `false`): allow private and loopback
  addresses, for local testing.

Over HTTP actions, a download writes nothing until it finishes, and time spent
waiting in the queue counts too. Keep `timeoutMs` below
`httpActions.idleTimeoutMs` (15 s by default), and when many clients download
at once, raise `idleTimeoutMs` or `concurrency` so queued downloads aren't cut
off as idle. Socket.IO clients are not affected.
