export const RSSFeed = `
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
<channel>
<title>
<![CDATA[ Sockethub ]]>
</title>
<description>
<![CDATA[ The polyglot solution to the federated social web ]]>
</description>
<link>https://sockethub.org</link>
<generator>metalsmith-feed</generator>
<lastBuildDate>Thu, 02 Sep 2021 22:16:22 GMT</lastBuildDate>
<atom:link href="https://sockethub.org/feed.xml" rel="self" type="application/rss+xml"/>
<author>
<![CDATA[ Nick Jennings ]]>
</author>
<item>
<title>
<![CDATA[ Sockethub 4.1.0 ]]>
</title>
<description>
<![CDATA[ <p>Sockethub 4.1.0 has been released! Lots of stability improvements, for a list see the <a href="https://github.com/sockethub/sockethub/releases/tag/v4.1.0">Sockethub release page</a>.</p> ]]>
</description>
<link>https://sockethub.org/news/2021-09-02-release-410.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2021-09-02-release-410.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Thu, 02 Sep 2021 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Sockethub 4.0.1 ]]>
</title>
<description>
<![CDATA[ <p>Sockethub 4.0.1 has been released! This release fixes a few minor issues present in the previous release, for a list of fixes see the <a href="https://github.com/sockethub/sockethub/releases/tag/v4.0.1">Sockethub release page</a>.</p> ]]>
</description>
<link>https://sockethub.org/news/2021-05-23-release-401.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2021-05-23-release-401.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Sun, 23 May 2021 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Sockethub 4.0.0 ]]>
</title>
<description>
<![CDATA[ <p>Sockethub 4.0.0 has been released! This release has a few major updates to the underlying system, namely switching from <code>node-simple-xmpp</code> to <code>xmpp.js</code>, from <code>Kue</code> to <code>Bull</code> and upgrading to <code>socket.io v4</code>. Additionally, as we performed these significant overhauls of the code, we added more tests and optimizations. This release should be overall a lot faster. For a full list of changes, see the <a href="https://github.com/sockethub/sockethub/releases/tag/v4.0.0">Sockethub release page</a>.</p> ]]>
</description>
<link>https://sockethub.org/news/2021-05-20-release-400.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2021-05-20-release-400.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Thu, 20 May 2021 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Sockethub 3.2.2 ]]>
</title>
<description>
<![CDATA[ <p>Sockethub 3.2.2 has been released and focuses mainly on stability and bugfixes, highlights include pegging the sockethub.io dependency version to resolve a CORS issues, and a hotfix for the IRC platforms upstream library <code>irc-socket</code> allowing TLS connections. For a full list of changes, see <a href="https://github.com/sockethub/sockethub/releases/tag/v3.2.2">Sockethub release page</a>.</p> ]]>
</description>
<link>https://sockethub.org/news/2021-02-22-sockethub-release-322.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2021-02-22-sockethub-release-322.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Mon, 22 Feb 2021 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Sockethub 3.2 ]]>
</title>
<description>
<![CDATA[ <p>Sockethub 3.2 has been released and includes a lot of improvements and work that has progressed throughout the year. The most notable improvement has come with the spawning of new threads for platform modules to help protect against possible platform crashes and memory leaks, which has greatly improved the stability of sockethub core. For a full list of changes, see <a href="https://github.com/sockethub/sockethub/releases/tag/v3.2.0">Sockethub release page</a>.</p> ]]>
</description>
<link>https://sockethub.org/news/2020-12-26-sockethub-release-320.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2020-12-26-sockethub-release-320.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Sat, 26 Dec 2020 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Sockethub 3.x ]]>
</title>
<description>
<![CDATA[ <p>Sockethub 3.0 has been released and includes a lot of improvements focusing mainly on XMPP and IRC, additionally a ton of internal improvements. Ongoing releases tracked on the <a href="https://github.com/sockethub/sockethub/releases">Github page</a>. </p> ]]>
</description>
<link>https://sockethub.org/news/2019-09-26-3x.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2019-09-26-3x.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Thu, 26 Sep 2019 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Kosmos group chat client ]]>
</title>
<description>
<![CDATA[ <p>Over the past several months, we&#39;ve been quietly working away at an open-source group chat platform, build upon Sockethub and remoteStorage, and sprinkling of other tools and services. It aims to address the same area as Slack and HipChat, but built in the open, on open protocols (IRC &amp; XMPP) allowing anyone to interface without needing to commit to a solitary platform. Today we met in Berlin and plan for a couple days of hacking and planning for our MVP target which should be coming soon.</p> <p>I haven&#39;t been announcing every Sockethub release, as they are very frequent and incremental, but be sure to check the github to see the latest activity.</p> <p>[ <a href="https://kosmos.org">kosmos</a> | <a href="https://github.com/67p/hyperchannel">github.com/67p/hyperchannel</a> | <a href="https://github.com/sockethub/sockethub">github.com/sockethub/sockethub</a>]</p> ]]>
</description>
<link>https://sockethub.org/news/2017-05-04-kosmos.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2017-05-04-kosmos.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Thu, 04 May 2017 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Hackerbeach V milestones v1.0.4 ]]>
</title>
<description>
<![CDATA[ <p>While 2016 was a year of mostly maintenance work, 2017 has started off strong. Meeting up with several of the guys at <a href="https://5apps.com">5apps</a> for <a href="http://hackerbeach.org">Hackerbeach V</a>, we&#39;re working toward building an open-source Slack replacement using unhosted technologies Sockethub and <a href="http://remotestorage.io">remoteStorage</a>. No further details at this time, but we&#39;re close to an MVP. In the meantime, I released Sockethub v1.0.4 and activity should increase as we deploy Sockethub for multi-user use.</p> <p>[ <a href="https://github.com/sockethub/sockethub/releases/tag/v1.0.4">release v1.0.4</a> ]</p> ]]>
</description>
<link>https://sockethub.org/news/2017-01-23-hakcerbeach-v.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2017-01-23-hakcerbeach-v.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Mon, 23 Jan 2017 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Version 1.0.0 released ]]>
</title>
<description>
<![CDATA[ <p>A branch which has been worked on for most of 2015 has been merged to the master branch and released as version 1.0.0. Currently only a couple platforms are fully ported over, but the plan is to continue to make incremental improvements. It&#39;s more stable and lightweight than the 0.x releases.</p> <p>[ <a href="https://github.com/sockethub/sockethub/releases/tag/v1.0.0">release v1.0.0</a> | <a href="https://github.com/sockethub/sockethub/blob/v1.0.0/CHANGELOG.md">CHANGELOG</a> ]</p> ]]>
</description>
<link>https://sockethub.org/news/2015-11-02-release-v1_0_0.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2015-11-02-release-v1_0_0.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Mon, 02 Nov 2015 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ The Oblivion Bar @ CCCamp2015 ]]>
</title>
<description>
<![CDATA[ <p>The team working on <a href="https://kosmos.org/">Kosmos</a> will have <a href="https://events.ccc.de/camp/2015/wiki/Village:The_Oblivion_Bar">a tent at Chaos Communication Camp 2015</a>. We&#39;ll be giving a talk on Kosmos, remoteStorage and Sockethub.</p> ]]>
</description>
<link>https://sockethub.org/news/2015-08-11-cccamp2015.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2015-08-11-cccamp2015.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Tue, 11 Aug 2015 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Microformat2 & RSS news entries ]]>
</title>
<description>
<![CDATA[ <p>Not only do we now have an <a href="http://sockethub.org/feed.xml">RSS feed</a> but and all of our news entries contain <a href="http://microformats.org/wiki/microformats2">microformat2</a> attributes and can receive webmentions via. <a href="http://webmention.io">webmention.io</a> <em>(though we&#39;re still working on doing something with those webmentions)</em></p> ]]>
</description>
<link>https://sockethub.org/news/2015-05-10-microformat2-news.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2015-05-10-microformat2-news.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Sun, 10 May 2015 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ New website ]]>
</title>
<description>
<![CDATA[ <p>The Sockethub website has had a makeover, we&#39;re now using the awesome <a href="http://metalsmith.io">metalsmith</a> static site generator to power things, this allows us to easily maintain news updates and provide an rss feed, and just generally keep things more modular.</p> ]]>
</description>
<link>https://sockethub.org/news/2015-05-09-new-website.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2015-05-09-new-website.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Sat, 09 May 2015 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Release v0.3.x ]]>
</title>
<description>
<![CDATA[ <p>fixes to the IRC platform and improved docker support</p> <p>[ <a href="https://github.com/sockethub/sockethub/releases/tag/v0.3.0">release v0.3.0</a> | <a href="https://github.com/sockethub/sockethub/blob/v0.3.0/CHANGELOG.md">CHANGELOG</a> ]</p> ]]>
</description>
<link>https://sockethub.org/news/2014-11-16-release-v0_3.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2014-11-16-release-v0_3.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Sun, 16 Nov 2014 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Release v0.2.x ]]>
</title>
<description>
<![CDATA[ <p>The sockethub v0.2.x branch has been released!</p> <p>[ <a href="https://github.com/sockethub/sockethub/releases/tag/v0.2.0">release v0.2.0</a> | <a href="https://github.com/sockethub/sockethub/blob/v0.2.0/CHANGELOG.md">CHANGELOG</a> ]</p> ]]>
</description>
<link>https://sockethub.org/news/2014-09-09-release-v0_2.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2014-09-09-release-v0_2.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Tue, 09 Sep 2014 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Dogfeed RSS/Atom Reader released ]]>
</title>
<description>
<![CDATA[ <p>A fully unhosted RSS/Atom reader using Sockethub + <a href="http://remotestorage.io">remoteStorage</a></p> <p>[ <a href="https://dogfeed.5apps.com">dogfeed</a> | <a href="https://github.com/silverbucket/dogfeed">github repository</a> | <a href="https://groups.google.com/forum/#!topic/unhosted/xzOueGY2GYA">official announcement</a> ]</p> ]]>
</description>
<link>https://sockethub.org/news/2013-09-05-dogfeed-rss-atom-reader-released.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2013-09-05-dogfeed-rss-atom-reader-released.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Thu, 05 Sep 2013 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Sockethub lightning talk at OHM2013 ]]>
</title>
<description>
<![CDATA[ <p><a href="https://silverbucket.net">Nick Jennings</a> will be giving a talk tonight on Sockethub @ <a href="https://program.ohm2013.org">OHM2013</a></p> <p>[ <a href="https://program.ohm2013.org/event/475.html">talk overview</a> ]</p> ]]>
</description>
<link>https://sockethub.org/news/2013-07-31-sockethub-talk-OHM2013.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2013-07-31-sockethub-talk-OHM2013.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Wed, 31 Jul 2013 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Sockethub talk @ PragueJS ]]>
</title>
<description>
<![CDATA[ <p><a href="https://silverbucket.net">Nick Jennings</a> will give a Sockethub talk at <a href="http://www.praguejs.cz">PragueJS</a></p> ]]>
</description>
<link>https://sockethub.org/news/2013-05-30-sockethub-talk-praguejs.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2013-05-30-sockethub-talk-praguejs.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Thu, 30 May 2013 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Invoice demo ]]>
</title>
<description>
<![CDATA[ <p>Sockethub &amp; <a href="http://remotestorage.io">remoteStorage</a> invoice demo on noBackend! <a href="http://invoice.nobackend.org/">http://invoice.nobackend.org/</a></p> ]]>
</description>
<link>https://sockethub.org/news/2013-05-27-invoice-demo.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2013-05-27-invoice-demo.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Mon, 27 May 2013 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Sockethub video from re:publica posted ]]>
</title>
<description>
<![CDATA[ <p>Sockethub video from re:publica is up on youtube: <a href="https://www.youtube.com/watch?v=KU4PZK48-dg">https://www.youtube.com/watch?v=KU4PZK48-dg</a></p> ]]>
</description>
<link>https://sockethub.org/news/2013-05-13-sockethub-video-posted.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2013-05-13-sockethub-video-posted.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Mon, 13 May 2013 00:00:00 GMT</pubDate>
</item>
<item>
<title>
<![CDATA[ Sockethub meetup & hackathon ]]>
</title>
<description>
<![CDATA[ <p>Sockethub meetup &amp; hackathon, May 11th and 12th. <a href="http://lanyrd.com/2013/sockethub/">http://lanyrd.com/2013/sockethub/</a></p> ]]>
</description>
<link>https://sockethub.org/news/2013-05-11-sockethub-meetup-hackathon.html</link>
<guid isPermaLink="true">https://sockethub.org/news/2013-05-11-sockethub-meetup-hackathon.html</guid>
<dc:creator>
<![CDATA[ Nick Jennings ]]>
</dc:creator>
<pubDate>Sat, 11 May 2013 00:00:00 GMT</pubDate>
</item>
</channel>
</rss>
`;
