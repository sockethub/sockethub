import type {
    ActivityActor,
    ActivityObject,
    ActivityStream,
} from "@sockethub/schemas";
import type { Author } from "podparse";

export enum ASFeedType {
    FEED_CHANNEL = "feed",
    FEEDS = "feeds",
}

export enum ASObjectType {
    ARTICLE = "article",
    NOTE = "note",
}

export interface PlatformFeedsActivityActor extends ActivityActor {
    type: ASFeedType.FEED_CHANNEL;
    name: string;
    id: string;
    link: string;
    description: string;
    image: unknown;
    categories: Array<string>;
    language: string;
    author: Author;
}

export interface PlatformFeedsActivityStream extends ActivityStream {
    id?: string;
    context: ASFeedType.FEEDS;
    actor: PlatformFeedsActivityActor;
    type: string;
    object?: PlatformFeedsActivityObject;
}

export interface PlatformFeedsActivityObject extends ActivityObject {
    type: ASObjectType;
    title: string;
    id: string;
    brief: string;
    content: string;
    contentType: string;
    url: string;
    published: string;
    updated: string;
    datenum: number;
    tags: Array<string>;
    media: Array<unknown>;
    source: string;
}
