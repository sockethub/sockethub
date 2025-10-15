# @sockethub/platform-metadata

A Sockethub platform module for extracting metadata from web pages using Open Graph scraping.

## About

This platform fetches and extracts metadata from web pages, including Open Graph data, site information, images, and other structured metadata. It uses the `open-graph-scraper` library to analyze web pages and return structured data in ActivityStreams format.

## Implemented Verbs (`@type`)

* **fetch** - Extract metadata from a web page URL

## Usage

Each Sockethub platform uses JSON Activity Streams 2.0 which are received from and sent to clients through the Sockethub service.

### Request Format

```json
{
  "@type": "fetch",
  "context": "metadata",
  "actor": {
    "@id": "https://example.com/page-to-analyze"
  }
}
```

### Response Format

The platform returns an ActivityStream object with extracted metadata:

```json
{
  "@type": "fetch",
  "context": "metadata",
  "actor": {
    "@id": "https://example.com/page-to-analyze",
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

- **Open Graph data**: Title, description, images, site name, URL, locale
- **Site information**: Favicon, character encoding
- **Canonical URLs**: Resolved and canonical page URLs
- **Media**: Images with dimensions and type information

## Dependencies

- **open-graph-scraper**: Core library for extracting Open Graph and metadata from web pages

## Error Handling

If metadata extraction fails (invalid URL, network issues, parsing errors), the platform will return an error through the standard Sockethub error handling mechanism.

## Use Cases

- **Link previews**: Generate rich previews for shared URLs
- **Content analysis**: Extract structured data from web pages
- **Social media integration**: Get Open Graph data for social sharing
- **Web scraping**: Collect metadata from multiple pages
- **SEO analysis**: Analyze page metadata and structure