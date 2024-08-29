import schemas from "@sockethub/schemas";
import type { ActivityStream, CredentialsObject, PlatformSession } from "@sockethub/schemas";
import IRC, { type GetClientCallback } from "./index.ts";
import "https://deno.land/x/deno_mocha/global.ts";
import { assertEquals, assertNotEquals } from "jsr:@std/assert";

const actor = {
  type: "person",
  id: "testingham@irc.example.com",
  name: "testingham",
};

const newActor = {
  type: "person",
  id: "testler@irc.example.com",
  name: "testler",
};

const targetRoom = {
  type: "room",
  id: "irc.example.com/a-room",
  name: "#a-room",
};

const validCredentials = {
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
    debug: function () {},
    updateActor: function async() {
        return Promise.resolve();
    },
    sendToClient: (_msg: ActivityStream, _special?: string): void => {},
};

describe("Initialize IRC Platform", () => {
  let platform;

  beforeEach(() => {
    platform = new IRC(mockSessionObject);
    platform.ircConnect = function (
      key: string,
      credentials: CredentialsObject,
      cb: GetClientCallback,
    ) {
      cb(null, {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        end: () => {},
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        on: function () {},
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        raw: () => {},
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

    it("invalid credentials type", () => {
      assertEquals(
        schemas.validateCredentials({
          context: "irc",
          type: "credentials",
          // @ts-expect-error test invalid params
          object: {
            host: "example.com",
            port: "6667",
          },
        }),
        "[irc] /object: must have required property 'type'",
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

  describe("platform type methods", () => {
    beforeEach((done) => {
      platform.connect(
        {
          context: "irc",
          type: "connect",
          actor: actor,
        },
        { object: { server: "a server address" } },
        done,
      );
    });

    describe("after join", () => {
      beforeEach((done) => {
        platform.join(
          {
            context: "irc",
            type: "join",
            actor: actor,
            target: targetRoom,
          },
          done,
        );
        platform.completeJob();
      });

      it("has join channel registered", () => {
        assertEquals(platform.channels.has("#a-room"), true);
      });

      it("leave()", (done) => {
        platform.leave(
          {
            context: "irc",
            type: "leave",
            actor: actor,
            target: targetRoom,
          },
          done,
        );
        platform.completeJob();
      });

      it("send()", (done) => {
        platform.send(
          {
            context: "irc",
            type: "send",
            actor: actor,
            object: { content: "har dee dar" },
            target: targetRoom,
          } as ActivityStream,
          done,
        );
        platform.completeJob();
      });

      it("update() topic", (done) => {
        platform.update(
          {
            context: "irc",
            type: "update",
            actor: actor,
            object: { type: "topic", content: "important details" },
            target: targetRoom,
          },
          validCredentials,
          done,
        );
        platform.completeJob();
      });

      it("update() nick change", (done) => {
        platform.update(
          {
            context: "irc",
            type: "update",
            actor: actor,
            object: { type: "address" },
            target: newActor,
          },
          validCredentials,
          done,
        );
        platform.completeJob();
      });

      it("query()", (done) => {
        platform.query(
          {
            context: "irc",
            type: "query",
            actor: actor,
            target: targetRoom,
            object: { type: "attendance" },
          },
          done,
        );
        platform.completeJob();
      });

      it("cleanup()", (done) => {
        assertEquals(platform.config.initialized, true);
        platform.cleanup(() => {
          assertEquals(platform.config.initialized, false);
          done();
        });
      });
    });
  });
});
