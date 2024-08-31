import { assertEquals } from "jsr:@std/assert";
import asObjects from "./validate.data.test.ts";
import loadPlatforms from "../bootstrap/load-platforms.ts";
import validate, { registerPlatforms } from "./validate.ts";
import { ActivityStream } from "@sockethub/schemas";

class FakeSockethubPlatform {
  constructor() {}
  get config() {
    return {};
  }
  get schema() {
    return {
      name: "fake platform",
      version: "0.0.1",
      credentials: {
        required: ["object"],
        properties: {
          actor: {
            type: "object",
            required: ["id"],
          },
          object: {
            type: "object",
            required: ["type", "user", "pass"],
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
              },
              user: {
                type: "string",
              },
              pass: {
                type: "string",
              },
            },
          },
        },
      },
      messages: {
        required: ["type"],
        properties: {
          type: {
            enum: ["echo", "fail"],
          },
        },
      },
    };
  }
}

const modules = {
  fakeplatform: FakeSockethubPlatform,
};

let platforms: Map<string, FakeSockethubPlatform>;
let mockInit: Record<string, unknown>;
(async function () {
  platforms = await loadPlatforms(["fakeplatform"], async (module) => {
    return Promise.resolve(modules[module]);
  });
  mockInit = {
    platforms: platforms,
  };
  await registerPlatforms(mockInit);
})();

describe("", () => {
  describe("platformLoad", () => {
    it("loads all platforms", () => {
      const expectedPlatforms = ["fakeplatform"];
      assertEquals(platforms.size, expectedPlatforms.length);
      for (const platform of expectedPlatforms) {
        assertEquals(platforms.has(platform), true);
      }
    });
  });

  describe("Middleware: Validate", () => {
    describe("AS object validations", () => {
      asObjects.forEach((obj) => {
        it(
          `${obj.type}: ${obj.name}, should ${obj.valid ? "pass" : "fail"}`,
          (done) => {
            validate(
              obj.type,
              "tests",
              mockInit,
            )(obj.input as ActivityStream, (msg) => {
              if (obj.output) {
                if (obj.output === "same") {
                  assertEquals(msg, obj.input);
                } else {
                  assertEquals(msg, obj.output);
                }
              }
              if (obj.valid) {
                assertEquals(msg instanceof Error, false);
              } else {
                assertEquals(msg instanceof Error, true);
                if (obj.error) {
                  assertEquals(msg.toString(), obj.error);
                }
              }
              done();
            });
          },
        );
      });
    });
  });
});
