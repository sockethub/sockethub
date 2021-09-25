/**
 * This is a platform for sockethub implementing Atom/RSS fetching functionality.
 *
 * Developed by Nick Jennings (nick@silverbucket.net)
 *
 * sockethub is licensed under the LGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of this module can be found here:
 *   git://github.com/sockethub/sockethub-platform-feeds.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

const FeedParser = require('feedparser');
const request = require('request');

const packageJSON = require('./package.json');

const PlatformSchema = {
  "version": packageJSON.version,
  "messages": {
    "required": [ "verb" ],
    "properties": {
      "verb": {
        "type": "string",
        "enum": [ "fetch" ]
      },
      "object": {
        "type": "object",
        "oneOf": [
          { "$ref": "#/definitions/objectTypes/feed-parameters-date" },
          { "$ref": "#/definitions/objectTypes/feed-parameters-url" },
        ]
      }
    },
    "definitions": {
      "objectTypes": {
        "feed-parameters-date": {
          "additionalProperties": false,
          "required": [ "objectType" ],
          "properties": {
            "objectType": {
              "enum": [ "parameters" ]
            },
            "limit": {
              "type": "number",
            },
            "property": {
              "enum": [ "date" ]
            },
            "after": {
              "type": "date"
            }
          }
        },
        "feed-parameters-url": {
          "additionalProperties": false,
          "required": [ "objectType" ],
          "properties": {
            "objectType": {
              "enum": [ "parameters" ]
            },
            "limit": {
              "type": "number",
            },
            "property": {
              "enum": [ "url" ]
            },
            "after": {
              "type": "string"
            }
          }
        }
      }
    }
  }
};

/**
 * Class: Feeds
 *
 * Handles all actions related to fetching feeds.
 *
 * Current supported feed types:
 *
 * - RSS (1 & 2)
 *
 * - Atom
 *
 * Uses the `node-feedparser` module as a base tool fetching feeds.
 *
 * https://github.com/danmactough/node-feedparser
 *
 * @constructor
 * @param {object} cfg a unique config object for this instance
 */
class Feeds {
  constructor(cfg) {
    cfg = (typeof cfg === 'object') ? cfg : {};
    this.id = cfg.id; // actor
    this.debug = cfg.debug;
  }

  get schema() {
    return PlatformSchema;
  }

  get config() {
    return {
      persist: false,
      requireCredentials: []
    }
  }

  /**
   * Function: fetch
   *
   * Fetches feeds from specified source. Upon completion it will send back a
   * response to the original request with a complete list of URLs in the feed
   * and total count.
   *
   * @param {object} job Activity streams object containing job data.
   * @param {object} cb
   *
   * @example
   *
   *  {
   *    context: "feeds",
   *    type: "fetch",
   *    actor: {
   *      id: 'aUniqueUserString',
   *      type: "person",
   *    },
   *    target: {
   *      id: 'https://blog.example.com/rss',
   *      type: "page"
   *    },
   *    object: {
   *      type: "parameters",
   *      limit: 10,    // default 10
   *      property: 'date'
   *      after: 'Tue Nov 26 2013 02:11:59 GMT+0100 (CET)',
   *
   *      // ... OR ...
   *
   *      property: 'link',
   *      after: 'https://www.news.com/articles/man-eats-car',
   *    }
   *  }
   *
   *
   *  // Without any parameters specified, the platform will return most
   *  // recent 10 articles fetched from the feed.
   *
   *  // Example of the resulting JSON AS Object:
   *
   *   {
   *     context: 'feeds',
   *     type: 'collection',
   *     actor: {
   *       type: 'page',
   *       name: 'Best Feed Inc.',
   *       id: 'https://blog.example.com/rss',
   *       description: 'Where the best feed comes to be the best',
   *       image: {
   *         type: 'image',
   *         width: '144',
   *         height: '144',
   *         url: 'https://example.com/images/bestfeed.jpg',
   *         mediaType: "image/jpeg"
   *       }
   *       favicon: 'https://example.com/favicon.ico',
   *       categories: ['best', 'feed', 'aminals'],
   *       language: 'en',
   *       author: 'John Doe'
   *     },
   *     totalItems: 10,
   *     items: [{
   *       id: "https://example.com/articles/about-stuff"
   *       type: 'document',
   *       title: 'About stuff...',
   *       url: "https://example.com/articles/about-stuff"
   *       date: "2013-05-28T12:00:00.000Z",
   *       datenum: 1369742400000,
   *       brief_html: "Brief synopsis of stuff...",
   *       brief_text: "Brief synopsis of stuff...",
   *       html: "Once upon a time...",
   *       text: "Once upon a time..."
   *       media: [
   *         {
   *           type: 'audio',
   *           length: '13908973',
   *           mediaType: 'audio/mpeg',
   *           url: 'https://example.com/media/thing.mpg'
   *         }
   *       ]
   *       tags: ['foo', 'bar']
   *     }, {
   *       id: "https://example.com/articles/blog-post"
   *       type: 'document',
   *       title: 'Blog post...',
   *       url: "https://example.com/articles/blog-post"
   *       date: "2013-05-29T14:00:00.000Z",
   *       datenum: 1369742400000,
   *       brief_html: "Brief synopsis of stuff...",
   *       brief_text: "Brief synopsis of stuff...",
   *       html: "Another blog post...",
   *       text: "Another blog post..."
   *       media: [
   *         {
   *           length: '13908973',
   *           type: 'audio/mpeg',
   *           url: 'https://example.com/media/thing.mpg'
   *         }
   *       ]
   *       tags: ['foo']
   *     }, { ... }]
   *   }
   *
   */
  fetch(job, cb) {
    // ready to execute job
    this.fetchFeed(job.target['@id'], job.object)
      .then((results) => {
        // result.target = job.actor;
        return cb(null, results);
      }).catch(cb);
  }

  cleanup(cb) {
    cb();
  }

  //
  // fetches the articles from a feed, adding them to an array
  // for processing
  fetchFeed(url, options) {
    let articles = [],
      actor; // queue of articles to buffer and filter before sending out.
    let cfg = parseConfig(options);
    this.debug('FEED URL: ' + url);
    return new Promise((resolve, reject) => {
      request(url)
      .on('error', reject)
      .pipe(new FeedParser(cfg))
      .on('error', reject)
      .on('meta', (meta)  => {
        this.debug('fetched feed: ' + meta.title);
        actor = buildFeedChannel(url, meta);
      }).on('readable', function() {
        const stream = this;
        let item;
        while (item = stream.read()) {
          let article = buildFeedEntry(actor);
          article.object = buildFeedObject(Date.parse(item.date) || 0, item);
          articles.push(article); // add to articles stack
        }
      }).on('end', () => {
        return resolve(articles);
      });
    });
  };
}

function buildFeedObject(dateNum, item) {
  return {
    '@type': 'feedEntry',
    displayName: item.title,
    title: item.title,
    date: item.date,
    datenum: dateNum,
    tags: item.categories,
    text: item.summary,
    html: item.summary,
    brief_text: item.description,
    brief_html: item.description,
    url: item.origlink || item.link || item.meta.link,
    '@id': item.origlink || item.link || item.meta.link + '#' + dateNum,
    media: item.enclosures,
    source: item.source
  };
}

function buildFeedEntry(actor) {
  return {
    actor: {
      '@type': 'feed',
        displayName: actor.name,
        '@id': actor.address,
        description: actor.description,
        image: actor.image,
        favicon: actor.favicon,
        categories: actor.categories,
        language: actor.language,
        author: actor.author
    },
    status: true,
    '@type': "post",
    object: {}
  };
}

function buildFeedChannel(url, meta) {
  return {
    '@type': 'feedChannel',
    name: (meta.title) ? meta.title : (meta.link) ? meta.link : url,
    address: url,
    description: (meta.description) ? meta.description : '',
    image: (meta.image) ? meta.image : {},
    favicon: (meta.favicon) ? meta.favicon : '',
    categories: (meta.categories) ? meta.categories : [],
    language: (meta.language) ? meta.language : '',
    author: (meta.author) ? meta.author : ''
  };
}

function extractDate(prop) {
  let date;
  try {
    date  = (typeof prop  === 'string') ? Date.parse(prop)  : (typeof prop  === 'number') ? prop  : 0;
  } catch (e) {
    return 'invalid date string passed: ' + prop + ' - ' + e;
  }
  return date;
}

/*
 * setting defaults and normalizing
 */
function parseConfig(options) {
  let cfg = {};
  cfg.limit = (options.limit) ? options.limit : 10;
  cfg.datenum = 0;
  if ((!cfg.property) || (cfg.property === 'date')) {
    cfg.after_datenum = extractDate(options.after);
    cfg.before_datenum = extractDate(options.before);
  }
  cfg.url = (options.url) ? options.url : null;
  cfg.from = 'after';
  if ((options.from) && (options.from === 'before')) {
    cfg.from = 'before';
  }
  return cfg;
}

module.exports = Feeds;
