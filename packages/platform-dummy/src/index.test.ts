import Dummy from "./index.ts";
import { assertEquals } from "jsr:@std/assert";
import { PlatformSession } from "@sockethub/schemas";
import { ActivityStream } from "../../schemas/src/index.ts";

import denoJson from "./../deno.json" with { type: "json" };

const mockPlatformSession: PlatformSession = {
    debug: (m: string) => {},
    sendToClient: (msg: ActivityStream, special?: string): void => {},
    updateActor: async (credentials: object): Promise<void> => {},
};

Deno.test("PlatformDummy", () => {
    const p = new Dummy(mockPlatformSession);
    assertEquals(p instanceof Dummy, true);
    assertEquals(p.debug, mockPlatformSession.debug);
    assertEquals(typeof p.echo, "function", "p.echo");
    assertEquals(typeof p.fail, "function", "p.fail");
    assertEquals(typeof p.cleanup, "function", "p.cleanup");
});
Deno.test("schema", () => {
    const p = new Dummy(mockPlatformSession);
    assertEquals(p.schema, {
        name: "dummy",
        version: denoJson.version,
        messages: {
            required: ["type"],
            properties: {
                type: {
                    enum: ["echo", "fail"],
                },
            },
        },
        credentials: {},
    });
});

Deno.test("echo", async () => {
    const p = new Dummy(mockPlatformSession);
    const msg: ActivityStream = {
        actor: { type: "person", id: "testactor" },
        type: "echo",
        context: "dummy",
        object: {
            type: "room",
            content: "foobar",
        },
    };
    p.echo(msg, (err, data) => {
        assertEquals(err, undefined);
        assertEquals(data, msg);
    });
});

Deno.test("fail", () => {
    const p = new Dummy(mockPlatformSession);
    const msg: ActivityStream = {
        actor: { type: "person", id: "testactor" },
        type: "echo",
        context: "dummy",
        object: {
            type: "room",
            content: "foobar",
        },
    };
    p.fail(msg, (err, data) => {
        assertEquals(err, Error("foobar"));
        assertEquals(data, undefined);
    });
});

Deno.test("cleanup", () => {
    const p = new Dummy(mockPlatformSession);
    p.cleanup(() => {
        assertEquals(true, true);
    });
});
