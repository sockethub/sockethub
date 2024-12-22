import { assertEquals } from "jsr:@std/assert";
import validateTestData from "./validate.data.test.ts";
import loadPlatforms, { type PlatformMap, type RequireFunction, type PlatformImport } from "../bootstrap/load-platforms.ts";
import validate, { registerPlatforms } from "./validate.ts";
import type { ActivityStream, PlatformConfig, PlatformConstructor } from "@sockethub/schemas";

class FakePlatformClass implements PlatformImport {
  id = "fakeplatform";
  moduleName = "fakeplatform";
  version = "0.1";
  types = ["echo", "fail"];
  constructor() {}
  get config() {
    return {} as PlatformConfig;
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

let platforms: PlatformMap;
let mockInit: Record<string, unknown>;

const mockRequireFunc: RequireFunction = (_moduleName: string) => {
  return FakePlatformClass as PlatformConstructor<FakePlatformClass>;
}

(async function () {
  platforms = await loadPlatforms(["fakeplatform"], mockRequireFunc);
  mockInit = {
    platforms: platforms,
  };
  await registerPlatforms(mockInit);
})();

Deno.test("platformLoad: loads all platforms", () => {
  const expectedPlatforms = ["fakeplatform"];
  assertEquals(platforms.size, expectedPlatforms.length);
  for (const platform of expectedPlatforms) {
    assertEquals(platforms.has(platform), true);
  }
});

validateTestData.forEach((obj) => {
  Deno.test(
    `Middleware - validate: ${obj.type}: ${obj.name}, should ${obj.valid ? "pass" : "fail"}`,
    () => {
      return new Promise((resolve) => {
        validate(
          obj.type,
          "tests",
          mockInit,
        )(obj.input as ActivityStream, (msg) => {
          if (obj.output) {
            if (obj.output === "same") {
              assertEquals(msg, obj.input);
            } else {
              assertEquals(msg, obj.output as unknown as ActivityStream);
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
          resolve();
        });
      });
    },
  );
});
