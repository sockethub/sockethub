/**
 * This is a platform for sockethub implementing Atom/RSS fetching functionality.
 *
 * copyright 2012-2015 Nick Jennings (https://github.com/silverbucket)
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

if (typeof(FeedParser) !== 'object') {
  FeedParser = require('feedparser');
}

if (typeof(request) !== 'object') {
  request = require('request');
}

var Promise = require('bluebird');

Promise.defer = function () {
  var resolve, reject;
  var promise = new Promise(function() {
    resolve = arguments[0];
    reject = arguments[1];
  });
  return {
      resolve: resolve,
    reject: reject,
    promise: promise
  };
};

var packageJSON = require('./package.json');


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
 * @param {object} Sockethub session object 
 */
function Feeds(session) {
  this.session = session;
  this.abort = false;
  return this;
}


Feeds.prototype.schema = {
  "version": packageJSON.version,
  "credentials": {},
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
 * Function: fetch
 *
 * Fetches feeds from specified source. Upon completion it will send back a 
 * response to the original request with a complete list of URLs in the feed 
 * and total count.
 *
 * @param {object} object} Activity streams object containing job data.
 *
 * @example
 *
 *  {
 *    context: "feeds",
 *    '@type': "fetch",
 *    actor: {
 *      '@id': 'https://dogfeed.com/user/nick@silverbucket',
 *      '@type': "person",
 *      displayName: "nick@silverbucket.net"
 *    },
 *    target: {
 *      '@id': 'http://blog.example.com/rss',
 *      '@type': "feed"
 *    },
 *    object: {
 *      '@type': "parameters",
 *      limit: 10,    // default 10
 *      property: 'date'
 *      after: 'Tue Nov 26 2013 02:11:59 GMT+0100 (CET)',
 *
 *      // ... OR ...
 *
 *      property: 'link',
 *      after: 'http://www.news.com/articles/man-eats-car',
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
 *     '@type': 'post',
 *     actor: {
 *       '@type': 'feed',
 *       displayName: 'Best Feed Inc.',
 *       '@id': 'http://blog.example.com/rss',
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
 *       '@id': 'https://dogfeed.com/user/nick@silverbucket',
 *       '@type': "person",
 *       displayName: "nick@silverbucket.net"
 *     },
 *     object: {
 *       '@id': "http://example.com/articles/about-stuff"
 *       '@type': 'post',
 *       title: 'About stuff...',
 *       url: "http://example.com/articles/about-stuff"
 *       date: "2013-05-28T12:00:00.000Z",
 *       datenum: 1369742400000,
 *       brief_html: "Brief synopsis of stuff...",
 *       brief_text: "Brief synopsis of stuff...",
 *       html: "Once upon a time...",
 *       text: "Once upon a time..."
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
Feeds.prototype.fetch = function (job, cb) {
  var self = this;

  // ready to execute job
  self._fetchFeed(job.target['@id'], job.object)
    .then(function (result) {
      result.target = job.actor;
      self.session.send(result);
      cb();
    }, function (err) {
      cb(err);
    }).catch(function (err) {
      cb(err);
    });
};


Feeds.prototype.cleanup = function (cb) {
  this.abort = true;
  cb();
};


function extractDate(prop) {
  var date;
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
  var cfg = {};
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

//
// fetches the articles from a feed, adding them to an array
// for processing
Feeds.prototype._fetchFeed = function (url, options) {
  if (this.abort) { return Promise.reject('aborting job'); }
  var defer = Promise.defer();

  var error = false;
  var articles = []; // queue of articles to buffer and filter before sending out.
  var session = this.session;
  var self = this;

  var cfg = parseConfig(options);
  if (typeof cfg === 'string') {
    return Promise.reject(cfg);
  }

  session.debug('issuing request');
  session.debug('FEED URL: ' + url);

  var actor;
  try {
    request(url)

    .on('error', function (e) {
      error = e.toString();
      session.debug('[on 1] failed to fetch feed from url: ' + url + ' : ' + error);
      defer.reject(error);
    })

    .pipe(new FeedParser())

    .on('error', function (e) {
      error = e.toString();
      session.debug('[on 2] failed to fetch feed from url: '+ url + ' : ' + error);
      defer.reject(error);
    })

    .on('meta', function (meta) {
      if (self.abort) {return;}
      session.debug('received feed: ' + meta.title);
      actor = {
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
    })

    .on('readable', function () {
      if (this.abort) { return defer.reject('aborting job'); }

      var stream = this, item;
      while (item = stream.read()) {
        var article = {
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
          object: {
            '@type': 'feedEntry'
          }
        };
        var datenum;
        try {
          datenum = Date.parse(item.date) || 0;
        } catch (e) {
          datenum = 0;
        }
        article.object.displayName = item.title;
        article.object.title = item.title;
        article.object.date = item.date;
        article.object.datenum = datenum;
        article.object.tags = item.categories;
        article.object.text = item.summary;
        article.object.html = item.summary;
        article.object.brief_text = item.description;
        article.object.brief_html = item.description;
        article.object.url = item.origlink || item.link;
        article.object.id = item.origlink || item.link;
        article.object.media = item.enclosures;
        article.object.source = item.source;

        // add to articles queue
        articles.push(article);
      }
    })

    .on('end', function () {
      if (this.abort) { return defer.reject('aborting job'); }

      if (error) {
        self.session.debug("ERROR ", error);
        return defer.reject(error);
      } else {
        session.debug("feed fetching completed.");

        return defer.resolve(articles);
      }
    });

  } catch (e) {
    if (self.abort) { return Promise.reject('aborting job'); }
    var error = e.toString();
    self.session.log('[try] failed to fetch feed from url: ' + url + ' : ' + error);
    defer.reject('failed to fetch feed from url: ' + url + ' : ' + error);
  }
  return defer.promise;
};


module.exports = Feeds;
