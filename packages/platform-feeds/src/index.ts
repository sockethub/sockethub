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

import htmlTags from "html-tags";
import getPodcastFromFeed, { type Meta } from "podparse";

import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSchemaStruct,
    PlatformSession,
} from "@sockethub/schemas";

import PlatformSchema from "./schema.js";
import {
    ASFeedType,
    ASObjectType,
    type PlatformFeedsActivityActor,
    type PlatformFeedsActivityObject,
    type PlatformFeedsActivityStream,
} from "./types.js";

const MAX_NOTE_LENGTH = 256;

const basic = /\s?<!doctype html>|(<html\b[^>]*>|<body\b[^>]*>|<x-[^>]+>)+/i;
const full = new RegExp(
    htmlTags.map((tag) => `<${tag}\\b[^>]*>`).join("|"),
    "i",
);

function isHtml(s: string): boolean {
    // limit it to a reasonable length to improve performance.
    s = s.trim().slice(0, 1000);
    return basic.test(s) || full.test(s);
}

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
 * Uses the `podparser` module as a base tool fetching feeds.
 *
 * https://github.com/Tombarr/podcast-feed-parser
 *
 */
export default class Feeds implements PlatformInterface {
    id: string;
    debug: Logger;
    config: PlatformConfig = {
        persist: false,
    };

    /**
     * @constructor
     * @param session - a unique session object for this platform instance
     */
    constructor(session: PlatformSession) {
        this.debug = session.debug;
    }

    get schema(): PlatformSchemaStruct {
        return PlatformSchema;
    }

    /**
     * Fetch feeds from specified source. Upon completion, it will send back a
     * response to the original request with a complete list of URLs in the feed
     * and total count.
     *
     * @param job - Activity streams object containing job data.
     * @param done - Callback function
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
     *         url: 'http://blog.example.com/images/bestfeed.jpg',
     *       }
     *       favicon: 'http://blog.example.com/favicon.ico',
     *       link: 'http://blog.example.com',
     *       categories: ['best', 'feed', 'aminals'],
     *       language: 'en',
     *       author: 'John Doe'
     *     },
     *     object: {
     *       id: "http://blog.example.com/articles/about-stuff"
     *       type: 'article',
     *       title: 'About stuff...',
     *       url: "http://blog.example.com/articles/about-stuff"
     *       date: "2013-05-28T12:00:00.000Z",
     *       datenum: 1369742400000,
     *       brief: "Brief synopsis of stuff...",
     *       content: "Once upon a time...",
     *       contentType: "text",
     *       media: [
     *         {
     *           length: '13908973',
     *           type: 'audio/mpeg',
     *           url: 'http://blog.example.com/media/thing.mpg'
     *         }
     *       ]
     *       tags: ['foo', 'bar']
     *     }
     *   }
     *
     */
    fetch(job: ActivityStream, done: PlatformCallback) {
        // ready to execute job
        this.fetchFeed(job.target.id, job.id)
            .then((results) => {
                return done(null, results);
            })
            .catch(done);
    }

    cleanup(done: PlatformCallback) {
        done();
    }

    // fetches the articles from a feed, adding them to an array
    // for processing
    private async fetchFeed(
        url: string,
        id: string,
    ): Promise<Array<PlatformFeedsActivityStream>> {
        this.debug("fetching " + url);
        const res = await fetch(url);
        const feed = getPodcastFromFeed(await res.text());
        const actor = buildFeedChannel(url, feed.meta);
        const articles = [];

        for (const item of feed.episodes) {
            const article = buildFeedStruct(actor);
            article.id = id;
            article.object = buildFeedItem(item);
            articles.push(article);
        }
        return articles;
    }
}

function buildFeedItem(item): PlatformFeedsActivityObject {
    const dateNum = Date.parse(item.pubDate.toString()) || 0;
    return {
        type:
            item.description.length > MAX_NOTE_LENGTH
                ? ASObjectType.ARTICLE
                : ASObjectType.NOTE,
        title: item.title,
        id: item.link || item.meta.link + "#" + dateNum,
        brief: item.description === item.summary ? undefined : item.summary,
        content: item.description,
        contentType: isHtml(item.description || "") ? "html" : "text",
        url: item.link || item.meta.link,
        published: item.pubDate,
        updated: item.pubDate === item.date ? undefined : item.date,
        datenum: dateNum,
        tags: item.categories,
        media: item.media,
        source: item.source,
    };
}

function buildFeedStruct(
    actor: PlatformFeedsActivityActor,
): PlatformFeedsActivityStream {
    return {
        context: ASFeedType.FEEDS,
        actor: actor,
        type: "post",
    };
}

function buildFeedChannel(url: string, meta: Meta): PlatformFeedsActivityActor {
    return {
        id: url,
        type: ASFeedType.FEED_CHANNEL,
        name: meta.title ? meta.title : meta.link ? meta.link : url,
        link: meta.link || url,
        description: meta.description ? meta.description : undefined,
        image: meta.image ? meta.image : undefined,
        categories: meta.category ? meta.category : [],
        language: meta.language ? meta.language : undefined,
        author: meta.author ? meta.author : undefined,
    };
}
