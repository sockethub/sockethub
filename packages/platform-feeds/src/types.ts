import { Author, Enclosure } from "podparse";

export enum ASFeedType {
  FEED_CHANNEL = "feed",
  FEEDS = "feeds"
}

export enum ASObjectType {
  ARTICLE = "article",
  NOTE = "note",
}

export interface ASFeedActor {
  type: ASFeedType.FEED_CHANNEL;
  name: string;
  id: string;
  link: string;
  description: string;
  summary: string;
  image: any;
  categories: Array<string>
  language: string;
  author: Author;
}


export type ASFeedStruct = {
  id?: string;
  context: ASFeedType.FEEDS;
  actor: ASFeedActor;
  type: string;
  object: {};
}

export type ASFeedEntry = {
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
  media: Enclosure | Array<any>;
}
