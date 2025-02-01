import SockethubClient from "./sockethub-client.ts";
import type { ASManager } from "@sockethub/activity-streams";
import type { ActivityStream } from "@sockethub/schemas";
import eventEmitter from "npm:eventemitter3";
import type { Socket } from "socket.io-client";

import "https://deno.land/x/deno_mocha/global.ts";
import {
    assertSpyCallArg,
    assertSpyCalls,
    type MethodSpy,
    spy,
    stub,
} from "jsr:@std/testing/mock";
import { assertEquals, assertNotEquals } from "jsr:@std/assert";

const EventEmitterConstructor =
    eventEmitter as unknown as typeof eventEmitter.default;

interface TestEmitter extends Socket {
    __instance: string;
}

interface TestASManager extends ASManager {
    on(): unknown;
    once(): unknown;
    off(): unknown;
    emit(activityObjectCreate: string, p: { foo: string }): unknown;
    Stream: (meta: unknown) => ActivityStream;
    Object: {
        create(): unknown;
        delete(): boolean;
        list(): IterableIterator<string>;
        get(): unknown;
    };
}

function timeout(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockASInstance(): TestASManager {
    const a = new EventEmitterConstructor() as unknown as TestASManager;
    a.Stream = (a) => {
        return a as ActivityStream;
    };

    a.on = () => {};
    a.Object = {
        create: () => {},
        delete: () => {
            return true;
        },
        list: () => {
            return new Map().keys();
        },
        get: () => {},
    };
    stub(a.Object, "create");
    stub(a.Object, "delete");
    stub(a.Object, "list");
    stub(a.Object, "get");
    return a;
}

// describe("SockethubClient bad initialization", () => {
//     it("no socket.io instance", () => {
//         class TestSockethubClient extends SockethubClient {
//             initActivityStreams() {
//                 this.ActivityStreams = {} as ASManager;
//             }
//         }
//         assertThrows(() => {
//             new TestSockethubClient("" as unknown as Socket);
//         }, "SockethubClient requires a socket.io instance");
//     });
// });

describe("SockethubClient", () => {
    let asInstance: TestASManager;
    let socket: TestEmitter;
    let sc: SockethubClient;
    let socketOnSpy: MethodSpy,
        socketEmitSpy: MethodSpy,
        asInstanceOnSpy: MethodSpy,
        scSocketOnSpy: MethodSpy,
        scSocketEmitSpy: MethodSpy,
        scSocket_EmitSpy: MethodSpy,
        asInstanceStreamSpy: MethodSpy;

    beforeEach(() => {
        socket = new EventEmitterConstructor() as unknown as TestEmitter;
        socket.__instance = "socketio"; // used to uniquely identify the object we're passing in
        socketOnSpy = spy(socket, "on");
        socketEmitSpy = spy(socket, "emit");

        asInstance = createMockASInstance();
        asInstanceStreamSpy = spy(asInstance, "Stream");
        asInstanceOnSpy = spy(asInstance, "on");

        class TestSockethubClient extends SockethubClient {
            override initActivityStreams() {
                this.ActivityStreams = asInstance as ASManager;
            }
        }

        sc = new TestSockethubClient(socket as TestEmitter) as SockethubClient;
        scSocketOnSpy = spy(sc.socket, "on");
        scSocketEmitSpy = spy(sc.socket, "emit");
        scSocket_EmitSpy = spy(sc.socket, "_emit");
    });

    afterEach(() => {
        socketOnSpy.restore();
        socketEmitSpy.restore();
        asInstanceOnSpy.restore();
        scSocketOnSpy.restore();
        scSocketEmitSpy.restore();
        scSocket_EmitSpy.restore();
    });

    it("contains the ActivityStreams property", () => {
        // console.log("-- typeof asInstance: " + typeof asInstance);
        // console.log(asInstance);
        // assertEquals(asInstance, sc.ActivityStreams);
        assertEquals(typeof asInstance.on, "function");
        assertEquals(typeof asInstance.Stream, "function");
        assertEquals(typeof sc.ActivityStreams.Object.create, "function");
    });

    it("contains the socket property", () => {
        assertEquals(sc.socket instanceof EventEmitterConstructor, true);
        // the object we passed in should not be the publicly available one
        assertNotEquals(sc.socket.__instance, "socketio");
        assertEquals(sc.debug, true);
        assertEquals(sc.online, false);
    });

    it("registers listeners for ActivityStream events", () => {
        assertSpyCalls(asInstanceOnSpy, 1);
        assertSpyCallArg(asInstanceOnSpy, 0, 0, "activity-object-create");
    });

    describe("registers listeners for socket events", () => {
        it("called 5 times", () => {
            assertSpyCalls(socketOnSpy, 5);
        });
        it("called connect", () => {
            assertSpyCallArg(socketOnSpy, 0, 0, "connect");
        });
        it("called connect_error", () => {
            assertSpyCallArg(socketOnSpy, 1, 0, "connect_error");
        });
        it("called disconnect", () => {
            assertSpyCallArg(socketOnSpy, 2, 0, "disconnect");
        });
        it("called message", () => {
            assertSpyCallArg(socketOnSpy, 3, 0, "message");
        });
        it("called activity-object", () => {
            assertSpyCallArg(socketOnSpy, 4, 0, "activity-object");
        });
    });

    describe("event handling", () => {
        it("activity-object will trigger activity-object-create which will be emitted by original socket", async () => {
            // emit an activity-object via socketIO
            socket.emit("activity-object", { foo: "bar" });
            await timeout(0);
            assertSpyCallArg(asInstanceOnSpy, 0, 0, "activity-object-create");
            assertSpyCallArg(socketEmitSpy, 0, 1, { foo: "bar" });
        });

        it("activity-object-create", async () => {
            asInstance.emit("activity-object-create", { foo: "bar" });
            await timeout(0);
            assertSpyCallArg(socketEmitSpy, 0, 0, "activity-object");
            assertSpyCallArg(socketEmitSpy, 0, 1, { foo: "bar" });
        });

        it("connect", async () => {
            assertEquals(sc.online, false);
            await new Promise<void>((resolve) => {
                sc.socket.on("connect", () => {
                    assertEquals(sc.online, true);
                    resolve();
                });
                socket.emit("connect");
            });
        });
        it("disconnect", async () => {
            sc.online = true;
            await new Promise<void>((resolve) => {
                sc.socket.on("disconnect", () => {
                    assertEquals(sc.online, false);
                    resolve();
                });
                socket.emit("disconnect");
            });
        });
        it("connect_error", async () => {
            await new Promise<void>((resolve) => {
                sc.socket.on("connect_error", () => {
                    resolve();
                });
                socket.emit("connect_error");
            });
        });
        it("message", async () => {
            await new Promise<void>((resolve) => {
                sc.socket.on("message", (obj) => {
                    assertEquals(obj, { food: "nar" });
                    resolve();
                });
                socket.emit("message", { food: "nar" });
            });
            await timeout(0);
            assertSpyCallArg(asInstanceStreamSpy, 0, 0, { food: "nar" });
        });
    });

    describe("event emitting", () => {
        // it("message (no actor)", () => {
        //     sc.online = true;
        //     // return new Promise((resolve, reject) => {
        //     assertThrows(
        //         () => {
        //             sc.socket.emit("message", { foo: "bar" }, () => {
        //                 console.log("shouldn't arrive at callback");
        //             });
        //         },
        //         Error,
        //         "a message",
        //     );
        //     // });
        // });
        it("message", async () => {
            sc.online = true;
            await new Promise<void>((resolve) => {
                socket.once("message", (data) => {
                    assertEquals(data, { actor: "bar", type: "bar" });
                    resolve();
                });
                sc.socket.emit("message", { actor: "bar", type: "bar" });
            });
        });
        it("message (join)", async () => {
            sc.online = true;
            await new Promise<void>((resolve) => {
                socket.once("message", (data) => {
                    assertEquals(data, { actor: "bar", type: "join" });
                    resolve();
                });
                sc.socket.emit("message", { actor: "bar", type: "join" });
            });
        });
        it("message (leave)", async () => {
            sc.online = true;
            await new Promise<void>((resolve) => {
                socket.once("message", (data) => {
                    assertEquals(data, { actor: "bar", type: "leave" });
                    resolve();
                });
                sc.socket.emit("message", { actor: "bar", type: "leave" });
            });
        });
        it("message (connect)", async () => {
            sc.online = true;
            await new Promise<void>((resolve) => {
                socket.once("message", (data) => {
                    assertEquals(data, { actor: "bar", type: "connect" });
                    resolve();
                });
                sc.socket.emit("message", { actor: "bar", type: "connect" });
            });
        });
        it("message (disconnect)", async () => {
            sc.online = true;
            await new Promise<void>((resolve) => {
                socket.once("message", (data) => {
                    assertEquals(data, { actor: "bar", type: "disconnect" });
                    resolve();
                });
                sc.socket.emit("message", { actor: "bar", type: "disconnect" });
            });
        });
        it("message (offline)", async () => {
            sc.online = false;
            await new Promise<void>((resolve) => {
                socket.once("message", (data) => {
                    assertEquals(data, { actor: "bar" });
                    resolve();
                });
                sc.socket.emit("message", { actor: "bar" });
            });
        });
        it("activity-object", async () => {
            sc.online = true;
            await new Promise<void>((resolve) => {
                socket.once("activity-object", (data) => {
                    assertEquals(data, { actor: "bar" });
                    resolve();
                });
                sc.socket.emit("activity-object", { actor: "bar" });
            });
        });
        it("credentials", async () => {
            sc.online = true;
            await new Promise<void>((resolve) => {
                socket.once("credentials", (data) => {
                    assertEquals(data, { actor: "bar" });
                    resolve();
                });
                sc.socket.emit("credentials", { actor: "bar" });
            });
        });
    });
});
