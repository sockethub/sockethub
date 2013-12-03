/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of sockethub can be found here:
 *   git://github.com/sockethub/sockethub.git
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
var Q = require('q');

var Feeds = function () {
  var pub = {};
  var session = {};
  var abort = false; // flagged when cleanup is called

  pub.schema = {};

  //
  // sends a set number/range of articles based on the config
  function sendArticles(articles, cfg) {

    if (cfg.from === 'after') {
      articles.sort(function (a, b) {
        return a.object.datenum - b.object.datenum;
      });
    } else {
      articles.sort(function (a, b) {
        return b.object.datenum - a.object.datenum;
      });
    }

    var prop;
    if (cfg.link) {
      prop = 'link';
    } else {
      prop = 'datenum';
    }

    var startSending = false;
    var count = 1;
    for (var i = 0, len = articles.length; i < len; i = i + 1) {
      if (startSending) {
        if (count < cfg.limit) {
          session.send(articles[i]);
          count = count + 1;
        } else {
          return;
        }
      } else if (articles[i].object[prop] === cfg[prop]) {
        // either the date or link matches, return the next cfg.limit articles
        startSending = true;
      } else {
        //console.log('article title: '+articles[i].object.title+' d:'+articles[i].object.datenum+' '+cfg[prop]);
        if ((cfg.from === 'after') &&
            ((cfg[prop] === 0) ||
             (articles[i].object[prop] >= cfg[prop]))) {
          session.send(articles[i]);
          count = count + 1;
          startSending = true;
        } else if ((cfg.from === 'before') &&
                   ((cfg[prop] === 0) ||
                    (articles[i].object[prop] <= cfg[prop]))) {
          session.send(articles[i]);
          count = count + 1;
          startSending = true;
        }
      }
    }
  }


  //
  // fetches the articles from a feed, adding them to an array
  // for processing
  function fetchFeed(url, options, errorObj, successObj) {
    if (abort) {return;}
    var q = Q.defer();
    var articleLinks = [];
    var error = false;
    var completed = false;
    var articles = []; // queue of articles to buffer and filter before sending out.

    /*
     * configuring some behavior
     */
    var cfg = {};
    cfg.limit = (options.limit) ? options.limit : 10;
    cfg.datenum = 0;
    try {
      cfg.datenum = (typeof options.date === 'string') ? Date.parse(options.date) : (typeof options.date === 'number') ? options.date : 0;
    } catch (e) {
      session.error('invalid date string passed '+options.date, e);
      q.reject('invalid date string passed: '+options.date+' - '+e);
      return q.promise;
    }
    cfg.link = (options.link) ? options.link : null;
    cfg.from = 'after';
    if ((options.from) && (options.from === 'before')) {
      cfg.from = 'before';
    }
    /* */

    session.info('issuing request');
    session.debug('FEED URL: ' + url);

    var actor;
    try {
      request(url)

      .on('error', function (e) {
        if (abort) {return;}
        session.error('[on] failed to fetch feed from url: '+ url+ ' : '+e.toString());
        error = e.toString();
        q.reject(error);
      })

      .pipe(new FeedParser())

      .on('error', function (e) {
        if (abort) {return;}
        session.error('[on] failed to fetch feed from url: '+ url+ ' : '+e.toString());
        error = e.toString();
      })

      .on('meta', function(meta) {
        if (abort) {return;}
        session.debug('received feed: ' + meta.title);
        actor = {
          name: (meta.title) ? meta.title : (meta.link) ? meta.link : url,
          address: url,
          description: (meta.description) ? meta.description : ''
        };

      })

      .on('readable', function () {
        if (abort) {return;}
        var stream = this, item;
        while (item = stream.read()) {
          var article = {
            actor: {
              name: actor.name,
              address: actor.address,
              description: actor.description
            },
            target: successObj.target,
            status: true,
            verb: "post",
            object: {}
          };
          datenum = 0;
          try {
            datenum = Date.parse(item.date) || 0;
          } catch (e) {
            datenum = 0;
          }
          article.object.title = item.title;
          article.object.date = item.date;
          article.object.datenum = datenum;
          article.object.tags = item.categories;
          article.object.text = item.summary,
          article.object.html = item.summary,
          article.object.brief_text = item.description;
          article.object.brief_html = item.description;
          article.object.link = item.origlink || item.link;
          article.object.media = item.enclosures;
          article.object.source = item.source;

          // add to articles queue
          articles.push(article);
          articleLinks.push(item.link);
        }
      })

      .on('end', function (e) {
        completed = true;
        if (abort) {return;}
        if (error) {
          console.log("ERROR");
          q.reject(error);
        } else {
          session.info("feed fetching successful. completed.");

          sendArticles(articles, cfg);
          q.resolve({
            totalArticles: articleLinks.length,
            articleLinks: articleLinks
          });
        }
      });

    } catch (e) {
      if (abort) {return;}
      session.log('[try] failed to fetch feed from url: '+ url+ ' : '+e.toString());
      errorObj.target[0] = { address: url};
      errorObj.message = e.toString();
      session.send(errorObj);
      q.reject('failed to fetch feed from url: '+ url+ ' : '+e.toString());
    }
    return q.promise;
  }


  pub.init = function (sess) {
    session = sess;
    var q = Q.defer();
    q.resolve();
    return q.promise;
  };


  /**
   * Function: fetch
   *
   * Fetches feeds from specified source.
   *
   * Parameters:
   *
   *   job - Activity streams object containing job data:
   *         {
   *           actor: {
   *             address: 'feeds'
   *           },
   *           verb: "fetch",
   *           target: [
   *             {
   *               address: '[feed_url]'
   *             },
   *             ...
   *           ],
   *           object: {
   *             limit: 10,    // default 10
   *             from: 'after' // returns articles *after* the date string
   *                           // other valid value is 'before'
   *             date: 'Tue Nov 26 2013 02:11:59 GMT+0100 (CET)',
   *             // ... OR ...
   *             link: 'http://www.news.com/articles/man-eats-car',
   *           }
   *         }
   *
   *         Without any properties specified, the platform will return most
   *         recent 20 articles fetched from the feed.
   *
   *         `date` - can be a date string, or seconds since 1970.
   *                if set to 0, then the platform will return either the
   *                most recent (from: 'before') or the oldest (from: 'after')
   *                up to `limit`;
   *
   * Returns:
   *
   *   Sends back an message with an AS object for each article, and upon
   *   completion it will send back a response to the original request with a
   *   complete list of URLs in the feed and total count.
   *
   */
  pub.fetch = function (job) {
    var q = Q.defer();

    var errorObj = { // preset obj for failed fetches
      verb: 'fetch',
      actor: {
        address: job.actor.addres
      },
      target: [],
      status: false,
      message: ''
    };

    var successObj = { // preset obj for success fetches
      verb: 'add',
      actor: {
        name: '',
        address: '',
        description: ''
      },
      target: [{ address: job.actor.address}],
      status: true,
      object: {
        title: '',
        date: '',
        tags: '',
        text: '',
        html: '',
        brief_text: '',
        brief_html: '',
        link: ''
      }
    };

    var jobs = 0;
    var completed = 0;
    var stats = {};
    var completedObj = {};

    function jobCompleted (url, result) {
      completed = completed + 1;
      completedObj[url] = result;
      if (jobs === completed) {
        q.resolve(completedObj);
      }
    }

    function jobFailed (url, err) {
      completed = completed + 1;
      completedObj[url] = err;
      if (jobs === completed) {
        q.reject(err, completedObj);
      }
    }

    function runJob (url, options) {
      fetchFeed(url, options, errorObj, successObj)
        .then(function (obj) {
          jobCompleted(url, obj);
        }, function (err) {
          jobFailed(url, err);
        });
    }

    if (typeof job.target !== 'object') {
      q.reject('no target specified');
    } else if (typeof job.target[0] === 'undefined') {
      q.reject('invalid target array');
    } else if (typeof job.target[0].address === 'undefined') {
      q.reject('no address found in first target object');
    } else {
      // ready to execute job

      // a job may complete before the next loop if there's an error, so
      // lets count the jobs before we process them...
      for (var i = 0, len = job.target.length; i < len; i = i + 1) {
        if (job.target[i].address) {
          jobs = jobs + 1;
        }
      }
      // now process them...
      for (i = 0, len = job.target.length; i < len; i = i + 1) {
        if (job.target[i].address) {
          runJob(job.target[i].address, job.object);
        }
      }

      var allJobsSent = true;
      if (jobs === completed) {
        q.resolve();
      }
    }

    return q.promise;
  };

  pub.cleanup = function () {
    var q = Q.defer();
    abort = true;
    q.resolve();
    return q.promise;
  };

  return pub;
};

module.exports = Feeds;
