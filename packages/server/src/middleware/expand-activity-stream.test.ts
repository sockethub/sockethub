import { expect } from 'chai';

import expandActivityStream from "./expand-activity-stream";

import asObjects from "./expand-activity-stream.test.data";
import ActivityStreams from '@sockethub/activity-streams';
import {IActivityStream} from "@sockethub/schemas";

const activity = ActivityStreams();
// register known activity objects
[
  {
    "id":"blah",
    "type":"person",
    "name":"dood"
  },
  {
    "id":"blah2",
    "type":"person",
    "name":"bob",
    "hello":"there",
    "i":[
      "am",
      "extras"
    ]
  },
  {
    "id":"sh-9K3Vk@irc.freenode.net",
    "type":"person",
    "name":"sh-9K3Vk",
    "image":{
      "height":250,
      "mediaType":"image/jpeg",
      "url":"https://example.org/image.jpg",
      "width":250
    },
    "url":"https://sockethub.org"
  },
  {
    "id":"blah3",
    "type":"person",
    "name":"bob",
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
      it(`${obj.type}: ${obj.name}, should ${obj.valid ? 'pass' : 'fail'}`, async () => {
        let msg;
        try {
          msg = await expandActivityStream(obj.input as IActivityStream);
        } catch (err) {
          if (obj.valid) {
            expect(err instanceof Error).to.be.false;
          } else {
            expect(err instanceof Error).to.be.true;
            if (obj.error) {
              expect(obj.error).to.equal(err.toString());
            }
          }
        }
        if (obj.output) {
          if (obj.output === 'same') {
            expect(obj.input).to.eql(msg);
          } else {
            expect(obj.output).to.eql(msg);
          }
        }
      });
    });
  });
});
