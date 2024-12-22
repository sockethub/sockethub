import schemas from "@sockethub/schemas";
import type {
  ActivityObject,
  ActivityStream,
  CredentialsObject,
  PersistentPlatformConfig,
  PlatformCallback,
  PlatformSession,
} from "@sockethub/schemas";
import IRC, {
  type GetClientCallback,
  IrcActionActivityStream,
} from "./index.ts";
import "https://deno.land/x/deno_mocha/global.ts";
import { assertEquals } from "jsr:@std/assert";
import type { PlatformIrcCredentialsObject } from "./types.ts";
import type IrcSchema from "./schema.ts";

const actor = {
  type: "person",
  id: "testingham@irc.example.com",
  name: "testingham",
};

const newActor = {
  type: "person",
  id: "testler@irc.example.com",
  name: "tester",
};

const targetRoom = {
  type: "room",
  id: "irc.example.com/a-room",
  name: "#a-room",
};

const validCredentials: PlatformIrcCredentialsObject = {
  context: "irc",
  type: "credentials",
  actor: actor,
  object: {
    type: "credentials",
    nick: "testingham",
    server: "irc.example.com",
  },
};

let loadedSchema = false;

const mockSessionObject: PlatformSession = {
  debug: function (_msg) {
    // console.log("logging: ", _msg);
  },
  updateActor: function async() {
    return Promise.resolve();
  },
  sendToClient: (_msg: ActivityStream, _special?: string): void => {},
};

interface MockIRC {
  schema: typeof IrcSchema;
  config: PersistentPlatformConfig;
  connect: IRC["connect"];
  join: IRC["join"];
  channels: IRC["channels"];
  leave: IRC["leave"];
  send: IRC["send"];
  query: IRC["query"];
  update: IRC["update"];
  cleanup: IRC["cleanup"];
  ircConnect: (
    credentials: PlatformIrcCredentialsObject,
    cb: GetClientCallback,
  ) => void;
  completeJob: (err?: string) => void;
}

describe("Initialize IRC Platform", () => {
  let platform: MockIRC;

  beforeEach(() => {
    platform = new IRC(mockSessionObject) as unknown as MockIRC;
    platform.ircConnect = function (
      _credentials: CredentialsObject,
      cb: GetClientCallback,
    ) {
      cb(null, {
        end: () => {
        },
        on: function () {
        },
        raw: () => {
        },
      });
    };
    if (!loadedSchema) {
      schemas.addPlatformSchema(
        platform.schema.credentials,
        `irc/credentials`,
      );
      loadedSchema = true;
    }
  });

  it("lists required types enum", () => {
    assertEquals(platform.schema.messages.properties.type.enum, [
      "connect",
      "update",
      "join",
      "leave",
      "send",
      "query",
      "announce",
    ]);
  });

  it("returns a config object", () => {
    assertEquals(platform.config, {
      persist: true,
      requireCredentials: ["connect", "update"],
      initialized: false,
    });
  });

  it("schema format validation", () => {
    assertEquals(schemas.validatePlatformSchema(platform.schema), "");
  });

  describe("credential schema", () => {
    it("valid credentials", () => {
      assertEquals(schemas.validateCredentials(validCredentials), "");
    });

    it("invalid credentials number", () => {
      assertEquals(
        schemas.validateCredentials({
          context: "irc",
          type: "credentials",
          // @ts-expect-error passing invalid params
          object: {
            host: "example.com",
            port: "6667",
          },
        }),
        "[irc] /object/port: must be number",
      );
    });

    it("invalid credentials additional properties", () => {
      assertEquals(
        schemas.validateCredentials({
          context: "irc",
          type: "credentials",
          // @ts-expect-error passing invalid params
          object: {
            host: "example.com",
            port: 6667,
          },
        }),
        "[irc] /object: must NOT have additional properties: host",
      );
    });

    it("invalid credentials type", () => {
      assertEquals(
        schemas.validateCredentials({
          context: "irc",
          type: "credentials",
          // @ts-expect-error passing invalid params
          object: {
            server: "example.com",
            port: 6667,
          },
        }),
        "[irc] /object: must have required property 'nick'",
      );
    });

    it("invalid credentials port", () => {
      assertEquals(
        // @ts-expect-error test invalid params
        schemas.validateCredentials({
          context: "irc",
          type: "credentials",
          object: {
            type: "credentials",
            host: "example.com",
            port: "6667",
          },
        }),
        "[irc] /object/port: must be number",
      );
    });

    it("invalid credentials additional prop", () => {
      assertEquals(
        // @ts-expect-error test invalid params
        schemas.validateCredentials({
          context: "irc",
          type: "credentials",
          object: {
            type: "credentials",
            host: "example.com",
            port: 6667,
          },
        }),
        "[irc] /object: must NOT have additional properties: host",
      );
    });
  });

  describe("platform methods (type) behave as expected", () => {
    beforeEach(() => {
      return new Promise((resolve) => {
        platform.connect(
          {
            context: "irc",
            type: "connect",
            actor: actor,
          },
          {
            object: { server: "a server address" },
          } as PlatformIrcCredentialsObject,
          resolve as PlatformCallback,
        );
      });
    });

    describe("join()", () => {
      beforeEach(() => {
        return new Promise((resolve, reject) => {
          platform.join(
            {
              context: "irc",
              type: "join",
              actor: actor,
              target: targetRoom,
            },
            (err?) => {
              if (err) {
                reject("platform.join failed: " + err);
              } else {
                resolve();
              }
            },
          );
          platform.completeJob();
        });
      });

      it("has join channel registered", () => {
        assertEquals(platform.channels.has(targetRoom.name), true);
      });

      it("leave()", () => {
        return new Promise((resolve) => {
          platform.leave(
            {
              context: "irc",
              type: "leave",
              actor: actor,
              target: targetRoom,
            },
            resolve as PlatformCallback,
          );
          platform.completeJob();
        });
      });

      it("send()", () => {
        return new Promise((resolve) => {
          platform.send(
            {
              context: "irc",
              type: "send",
              actor: actor,
              object: { content: "har dee dar" },
              target: targetRoom,
            } as IrcActionActivityStream,
            resolve as PlatformCallback,
          );
          platform.completeJob();
        });
      });

      it("update() topic", () => {
        return new Promise((resolve) => {
          platform.update(
            {
              context: "irc",
              type: "update",
              actor: actor,
              object: { type: "topic", content: "important details" },
              target: targetRoom,
            },
            validCredentials,
            resolve as PlatformCallback,
          );
          platform.completeJob();
        });
      });

      it("update() nick change", () => {
        return new Promise((resolve) => {
          platform.update(
            {
              context: "irc",
              type: "update",
              actor: actor,
              object: { type: "address" },
              target: newActor,
            },
            validCredentials,
            resolve as PlatformCallback,
          );
          platform.completeJob();
        });
      });

      it("query()", () => {
        return new Promise((resolve) => {
          platform.query(
            {
              context: "irc",
              type: "query",
              actor: actor,
              target: targetRoom,
              object: { type: "attendance" },
            },
            resolve as PlatformCallback,
          );
          platform.completeJob();
        });
      });

      it("cleanup()", () => {
        return new Promise((resolve) => {
          assertEquals(platform.config.initialized, true);
          platform.cleanup(() => {
            assertEquals(platform.config.initialized, false);
            resolve();
          });
        });
      });
    });
  });
});
