import { assertEquals } from "jsr:@std/assert";
import expandActivityStream from "./expand-activity-stream.ts";
import asObjects from "./expand-activity-stream.data.test.ts";
import ActivityStreams from "@sockethub/activity-streams";
import type { ActivityStream } from "@sockethub/schemas";

const activity = ActivityStreams();
// register known activity objects
[
  {
    id: "blah",
    type: "person",
    name: "dood",
  },
  {
    id: "blah2",
    type: "person",
    name: "bob",
    hello: "there",
    i: ["am", "extras"],
  },
  {
    id: "sh-9K3Vk@irc.freenode.net",
    type: "person",
    name: "sh-9K3Vk",
    image: {
      height: 250,
      mediaType: "image/jpeg",
      url: "https://example.org/image.jpg",
      width: 250,
    },
    url: "https://sockethub.org",
  },
  {
    id: "blah3",
    type: "person",
    name: "bob",
    hello: "there",
    i: ["am", "extras"],
  },
].forEach((obj) => {
  activity.Object.create(obj);
});

// describe("Middleware: Expand Activity Stream", () => {
//   describe("AS object expansion", () => {
asObjects.forEach((obj) => {
  Deno.test(
    `${obj.type}: ${obj.name}, should ${obj.valid ? "pass" : "fail"}`,
    () => {
      return new Promise((resolve) => {
        expandActivityStream(obj.input as ActivityStream, (msg: unknown) => {
          if (obj.output) {
            if (obj.output === "same") {
              assertEquals(obj.input, msg);
            } else {
              assertEquals(obj.output, msg);
            }
          }
          if (obj.valid) {
            assertEquals(msg instanceof Error, false);
          } else {
            assertEquals(msg instanceof Error, true);
            if (obj.error) {
              assertEquals(obj.error, msg!.toString());
            }
          }
          resolve();
        });
      })

    },
  );
});
