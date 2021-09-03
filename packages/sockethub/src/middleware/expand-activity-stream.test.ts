import { expect } from 'chai';

import expandActivityStream from "./expand-activity-stream";

import asObjects from "./expand-activity-stream.test.data";
import ActivityStreams from 'activity-streams';

const activity = ActivityStreams();
// register known activity objects
[
  {
    "@id":"blah",
    "@type":"person",
    "displayName":"dood"
  },
  {
    "@id":"blah2",
    "@type":"person",
    "displayName":"bob",
    "hello":"there",
    "i":[
      "am",
      "extras"
    ]
  },
  {
    "@id":"sh-9K3Vk@irc.freenode.net",
    "@type":"person",
    "displayName":"sh-9K3Vk",
    "image":{
      "height":250,
      "mediaType":"image/jpeg",
      "url":"http://example.org/image.jpg",
      "width":250
    },
    "url":"http://sockethub.org"
  },
  {
    "@id":"blah3",
    "@type":"person",
    "displayName":"bob",
    "hello":"there",
    "i":[
      "am",
      "extras"
    ]
  }
].forEach((obj) => {
  activity.Object.create(obj);
});

describe('Middleware: Expand Activity Stream', () => {
  describe('AS object expansion', () => {
    asObjects.forEach((obj) => {
      it(`${obj.type}: ${obj.name}, should ${obj.valid ? 'pass' : 'fail'}`, (done) => {
        // @ts-ignore
        expandActivityStream(obj.input, (msg) => {
          if (obj.output) {
            if (obj.output === 'same') {
              expect(obj.input).to.eql(msg);
            } else {
              expect(obj.output).to.eql(msg);
            }
          }
          if (obj.valid) {
            expect(msg instanceof Error).to.be.false;
          } else {
            expect(msg instanceof Error).to.be.true;
            if (obj.error) {
              expect(obj.error).to.equal(msg.toString());
            }
          }
          done();
        });
      });
    });
  });
});
