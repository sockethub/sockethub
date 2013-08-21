var url = 'http://www.eventbrite.com/rss/organizer_list_events/2377714302';
var FeedParser = require('feedparser');

var request = require('request');

console.log('fetch: '+url);
request(url)

.on('error', function (e) {
  console.log('[on] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
})

.pipe(new FeedParser())

.on('error', function (e) {
  console.log('[on] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
})

.on('meta', function(meta) {
  console.log('received feed: ' + meta.title);
})

.on('readable', function () {
  console.log('sending feed article for: ' + successObj.actor.name);
})

.on('end', function () {
  console.log('end');
});