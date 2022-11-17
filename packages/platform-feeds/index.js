/**
 * This is a platform for Sockethub implementing Atom/RSS fetching functionality.
 *
 * Developed by Nick Jennings (https://github.com/silverbucket)
 *
 * Sockethub is licensed under the LGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of this module can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about Sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

const FeedParser = require("feedparser");
const request = require("request");
const htmlTags = require("html-tags");

const basic = /\s?<!doctype html>|(<html\b[^>]*>|<body\b[^>]*>|<x-[^>]+>)+/i;
const full = new RegExp(
  htmlTags.map((tag) => `<${tag}\\b[^>]*>`).join("|"),
  "i"
);

function isHtml(string) {
  // limit it to a reasonable length to improve performance.
  string = string.trim().slice(0, 1000);
  return basic.test(string) || full.test(string);
}

const PlatformSchema = {
  name: "feeds",
  version: require("./package.json").version,
  messages: {
    required: ["type"],
    properties: {
      type: {
        type: "string",
        enum: ["fetch"],
      },
      object: {
        type: "object",
        oneOf: [
          { $ref: "#/definitions/objectTypes/feed-parameters-date" },
          { $ref: "#/definitions/objectTypes/feed-parameters-url" },
        ],
      },
    },
  },
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
    cfg = typeof cfg === "object" ? cfg : {};
    this.id = cfg.id; // actor
    this.debug = cfg.debug;
  }

  get schema() {
    return PlatformSchema;
  }

  get config() {
    return {
      persist: false,
      requireCredentials: [],
    };
  }

  /**
   * Function: fetch
   *
   * Fetch feeds from specified source. Upon completion, it will send back a
   * response to the original request with a complete list of URLs in the feed
   * and total count.
   *
   * @param {object} job Activity streams object containing job data.
   * @param {object} done
   *
   * @example
   *
   *  {
   *    context: "feeds",
   *    type: "fetch",
   *    actor: {
   *      id: 'https://dogfeed.com/user/nick@silverbucket',
   *      type: "person",
   *      name: "nick@silverbucket.net"
   *    },
   *    target: {
   *      id: 'http://blog.example.com/rss',
   *      type: "feed"
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
   *     type: 'post',
   *     actor: {
   *       type: 'feed',
   *       name: 'Best Feed Inc.',
   *       id: 'http://blog.example.com/rss',
   *       description: 'Where the best feed comes to be the best',
   *       image: {
   *         width: '144',
   *         height: '144',
   *         url: 'http://example.com/images/bestfeed.jpg',
   *       }
   *       favicon: 'http://example.com/favicon.ico',
   *       categories: ['best', 'feed', 'aminals'],
   *       language: 'en',
   *       author: 'John Doe'
   *     },
   *     target: {
   *       id: 'https://dogfeed.com/user/nick@silverbucket',
   *       type: "person",
   *       name: "nick@silverbucket.net"
   *     },
   *     object: {
   *       id: "http://example.com/articles/about-stuff"
   *       type: 'post',
   *       title: 'About stuff...',
   *       url: "http://example.com/articles/about-stuff"
   *       date: "2013-05-28T12:00:00.000Z",
   *       datenum: 1369742400000,
   *       brief: "Brief synopsis of stuff...",
   *       content: "Once upon a time...",
   *       contentType: "text",
   *       media: [
   *         {
   *           length: '13908973',
   *           type: 'audio/mpeg',
   *           url: 'http://example.com/media/thing.mpg'
   *         }
   *       ]
   *       tags: ['foo', 'bar']
   *     }
   *   }
   *
   */
  fetch(job, done) {
    // ready to execute job
    this.fetchFeed(job.target.id, job.id)
      .then((results) => {
        return done(null, results);
      })
      .catch(done);
  }

  cleanup(done) {
    done();
  }

  //
  // fetches the articles from a feed, adding them to an array
  // for processing
  fetchFeed(url, id) {
    let articles = [],
      actor; // queue of articles to buffer and filter before sending out.
    return new Promise((resolve, reject) => {
      request(url)
        .on("error", reject)
        .pipe(new FeedParser())
        .on("error", reject)
        .on("meta", (meta) => {
          actor = buildFeedChannel(url, meta);
        })
        .on("readable", function () {
          const stream = this;
          let item;
          while ((item = stream.read())) {
            let article = buildFeedEntry(actor);
            article.object = buildFeedObject(Date.parse(item.date) || 0, item);
            article.id = id;
            articles.push(article); // add to articles stack
          }
        })
        .on("end", () => {
          return resolve(articles);
        });
    });
  }
}

function buildFeedObject(dateNum, item) {
  return {
    type: "feedEntry",
    title: item.title,
    id: item.origlink || item.link || item.meta.link + "#" + dateNum,
    brief: item.description === item.summary ? undefined : item.summary,
    content: item.description,
    contentType: isHtml(item.description || "") ? "html" : "text",
    url: item.origlink || item.link || item.meta.link,
    published: item.pubdate || item.date,
    updated: item.pubdate === item.date ? undefined : item.date,
    datenum: dateNum,
    tags: item.categories,
    media: item.enclosures,
    source: item.source,
  };
}

function buildFeedEntry(actor) {
  return {
    context: "feeds",
    actor: {
      type: "feed",
      name: actor.name,
      id: actor.address,
      description: actor.description,
      image: actor.image,
      favicon: actor.favicon,
      categories: actor.categories,
      language: actor.language,
      author: actor.author,
    },
    type: "post",
    object: {},
  };
}

function buildFeedChannel(url, meta) {
  return {
    type: "feedChannel",
    name: meta.title ? meta.title : meta.link ? meta.link : url,
    address: url,
    description: meta.description ? meta.description : "",
    image: meta.image ? meta.image : {},
    favicon: meta.favicon ? meta.favicon : "",
    categories: meta.categories ? meta.categories : [],
    language: meta.language ? meta.language : "",
    author: meta.author ? meta.author : "",
  };
}

module.exports = Feeds;
