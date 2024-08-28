import SockethubClient from "./sockethub-client.ts";
import type { ASManager } from "@sockethub/activity-streams";
import eventEmitter, { type EventEmitter } from "npm:eventemitter3";
import type { Socket } from "socket.io-client";

import "https://deno.land/x/deno_mocha/global.ts";
import {
    assertSpyCall,
    assertSpyCalls,
    type MethodSpy,
    spy,
    stub,
} from "jsr:@std/testing/mock";
import { assertEquals, assertNotEquals, assertThrows } from "jsr:@std/assert";

const EventEmitterConstructor =
    eventEmitter as unknown as typeof eventEmitter.default;

interface TestEmitter extends Socket {
    __instance: string;
}

interface TestASManager extends EventEmitter {
    Stream: unknown;
    Object: {
        create(): unknown;
        delete(): unknown;
        list(): unknown;
        get(): unknown;
    };
}

function timeout(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockASInstance(): TestASManager {
    const a = new EventEmitterConstructor() as unknown as TestASManager;
    stub(a, "Stream");
    a.Object = {
        create: () => {},
        delete: () => {},
        list: () => {},
        get: () => {},
    };
    stub(a.Object, "create");
    stub(a.Object, "delete");
    stub(a.Object, "list");
    stub(a.Object, "get");
    return a;
}

describe("SockethubClient bad initialization", () => {
    it("no socket.io instance", () => {
        class TestSockethubClient extends SockethubClient {
            initActivityStreams() {
                this.ActivityStreams = {} as ASManager;
            }
        }
        assertThrows(() => {
            new TestSockethubClient("" as unknown as Socket);
        }, "SockethubClient requires a socket.io instance");
    });
});

describe("SockethubClient", () => {
    let asInstance: TestASManager;
    let socket: TestEmitter;
    let sc: SockethubClient;
    let socketOnSpy: MethodSpy,
        socketEmitSpy: MethodSpy,
        asInstanceOnSpy: MethodSpy,
        asInstanceEmitSpy: MethodSpy,
        scSocketOnSpy: MethodSpy,
        scSocketEmitSpy: MethodSpy,
        scSocket_EmitSpy: MethodSpy;

    beforeEach(() => {
        socket = new EventEmitterConstructor() as unknown as TestEmitter;
        socket.__instance = "socketio"; // used to uniquely identify the object we're passing in
        socketOnSpy = spy(socket, "on");
        socketEmitSpy = spy(socket, "emit");

        asInstance = createMockASInstance();
        asInstanceOnSpy = spy(asInstance, "on");
        asInstanceEmitSpy = spy(asInstance, "emit");

        class TestSockethubClient extends SockethubClient {
            initActivityStreams() {
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
        asInstanceEmitSpy.restore();
        scSocketOnSpy.restore();
        scSocketEmitSpy.restore();
        scSocket_EmitSpy.restore();
    });

    it("contains the ActivityStreams property", () => {
        console.log("-- typeof asInstance: " + typeof asInstance);
        // assertEquals(asInstance, sc.ActivityStreams);
        assertEquals(typeof asInstance.Stream, "function");
        assertEquals(typeof sc.ActivityStreams.Object.create, "function");
    });

    it("contains the socket property", () => {
        assertEquals(sc.socket instanceof EventEmitterConstructor, true);
        // the object we passed in should not be the publically available one
        assertNotEquals(sc.socket.__instance, "socketio");
        assertEquals(sc.debug, true);
        assertEquals(sc.online, false);
    });

    it("registers listeners for ActivityStream events", () => {
        assertSpyCalls(asInstanceOnSpy, 1);
        assertSpyCall(asInstanceOnSpy, 0, {
            args: ["activity-object-create", () => {}],
        });
    });

    // it("registers listeners for socket events", () => {
    //     assertSpyCalls(socketOnSpy, 5);
    //     assertSpyCall(socketOnSpy, 0, {args:["connect", async ()=>{}]});
    //     assertSpyCall(socketOnSpy, 1, {args:["connect_error"]});
    //     assertSpyCall(socketOnSpy, 2, {args:["activity-object"]});
    //     assertSpyCall(socketOnSpy, 3, {args:["disconnect"]});
    //     assertSpyCall(socketOnSpy, 4, {args:["message"]});
    // });

    describe("event handling", function () {
        //     it("activity-object", async () => {
        //         // emit an acitivy-object via socketIO
        //         socket.emit("activity-object", { foo: "bar" });
        //         await timeout(500);
        //         assertSpyCalls(asInstanceOnSpy, 1);
        //         assertSpyCall(asInstanceOnSpy, 0, {
        //                 args: [
        //                 "activity-object-create",
        //                 { foo: "bar" }
        //             ]
        //         });
        //     });
        //     it("activity-object-create", async () => {
        //         asInstance.emit("activity-object-create", { foo: "bar" });
        //         await timeout(0);
        //         assertSpyCalls(socketEmitSpy, 1);
        //         assertSpyCall(socketEmitSpy, 0, { args: [
        //             "activity-object", {foo: "bar"}
        //         ]});
        //     });
        //     it("connect", async () => {
        //         assertEquals(sc.online, false);
        //         await new Promise<void>((resolve) => {
        //             sc.socket.on("connect", () => {
        //                 assertEquals(sc.online, true);
        //                 console.log("-- _emit_spy: ", scSocket_EmitSpy);
        //                 console.log("-- emit_spy: ", scSocketEmitSpy);
        //                 console.log('-- orig: ', sc.socket._emit);
        //                 assertSpyCalls(scSocket_EmitSpy, 1);
        //                 assertSpyCall(scSocket_EmitSpy, 0, { args: ["connect"]});
        //                 resolve();
        //             });
        //             socket.emit("connect");
        //         });
        //     });
        //     it("disconnect", async () => {
        //         sc.online = true;
        //         await new Promise<void>((resolve) => {
        //             sc.socket.on("disconnect", () => {
        //                 assertEquals(sc.online, false);
        //                 assertSpyCalls(scSocket_EmitSpy, 1);
        //                 assertSpyCall(scSocket_EmitSpy, 0, { args: ["disconnect"]});
        //                 resolve();
        //             });
        //             socket.emit("disconnect");
        //         });
        //     });
        //     it("connect_error", async () => {
        //         await new Promise<void>((resolve) => {
        //             sc.socket.on("connect_error", () => {
        //                 assertSpyCalls(scSocket_EmitSpy, 1);
        //                 assertSpyCall(scSocket_EmitSpy, 0, { args: ["connect_error"]});
        //                 resolve();
        //             });
        //             socket.emit("connect_error");
        //         });
        //     });
        //     it("message", async () => {
        //         let checked = false;
        //         await new Promise<void>((resolve, reject) => {
        //             sc.socket.on("message", () => {
        //                 assertSpyCalls(scSocket_EmitSpy, 1);
        //                 assertSpyCall(scSocket_EmitSpy, 0, { args: ["message"]})
        //                 checked = true;
        //             });
        //             socket.emit("message", () => {
        //                 if (checked == true) { resolve(); }
        //                 else { reject("checks not triggered"); }
        //             });
        //         });
        //     });
        // });
        // describe("event emitting", () => {
        //     it("message (no actor)", () => {
        //         sc.online = true;
        //         const callback = () => {};
        //         assertThrows(() => {
        //             sc.socket.emit("message", { foo: "bar" }, callback);
        //         }, "actor property not present");
        //     });
        //     it("message", async () => {
        //         sc.online = true;
        //         await new Promise<void>((resolve) => {
        //             socket.once("message", (data, cb) => {
        //                 assertEquals(data, { actor: "bar", type: "bar" });
        //                 assertEquals(cb, () => {});
        //                 resolve();
        //             });
        //             sc.socket.emit("message", { actor: "bar", type: "bar" });
        //         });
        //     });
        //     it("message (join)", async () => {
        //         sc.online = true;
        //         let checked = false;
        //         await new Promise<void>((resolve, reject) => {
        //             socket.once("message", (data, cb) => {
        //                 assertEquals(data, { actor: "bar", type: "join" });
        //                 assertEquals(cb, () => {});
        //                 checked = true;
        //             });
        //             sc.socket.emit("message", { actor: "bar", type: "join" }, () => {
        //                 if (checked == true) { resolve(); }
        //                 else { reject("checks not triggered"); }
        //             });
        //         });
        //     });
        //     it("message (leave)", async () => {
        //         sc.online = true;
        //         let checked = false;
        //         await new Promise<void>((resolve, reject) => {
        //             socket.once("message", (data, cb) => {
        //                 assertEquals(data, { actor: "bar", type: "leave" });
        //                 assertEquals(cb, () => {});
        //                 checked = true;
        //             });
        //             sc.socket.emit(
        //                 "message",
        //                 { actor: "bar", type: "leave" },
        //                 () => {
        //                     if (checked == true) { resolve(); }
        //                     else { reject("checks not triggered"); }
        //                 },
        //             );
        //         });
        //     });
        //     it("message (connect)", async () => {
        //         sc.online = true;
        //         let checked = false;
        //         await new Promise<void>((resolve, reject) => {
        //             socket.once("message", (data, cb) => {
        //                 assertEquals(data, { actor: "bar", type: "connect" });
        //                 assertEquals(cb, () => {});
        //                 checked = true;
        //             });
        //             sc.socket.emit(
        //                 "message",
        //                 { actor: "bar", type: "connect" },
        //                 () => {
        //                     if (checked == true) { resolve(); }
        //                     else { reject("checks not triggered"); }
        //                 },
        //             );
        //         });
        //     });
        //     it("message (disconnect)", async () => {
        //         sc.online = true;
        //         let checked = false;
        //         await new Promise<void>((resolve, reject) => {
        //             socket.once("message", (data, cb) => {
        //                 assertEquals(data, { actor: "bar", type: "disconnect" });
        //                 assertEquals(cb, () => {});
        //                 checked = true;
        //             });
        //             sc.socket.emit(
        //                 "message",
        //                 { actor: "bar", type: "disconnect" },
        //                 () => {
        //                     if (checked == true) { resolve(); }
        //                     else { reject("checks not triggered"); }
        //                 },
        //             );
        //         });
        //     });
        //     it("message (offline)", async () => {
        //         sc.online = false;
        //         let checked = false;
        //         await new Promise<void>((resolve, reject) => {
        //             socket.once("message", (data, cb) => {
        //                 assertEquals(data, { actor: "bar" });
        //                 assertEquals(cb, () => {});
        //                 checked = true;
        //             });
        //             sc.socket.emit("message", { actor: "bar" }, () => {
        //                 if (checked == true) { resolve(); }
        //                 else { reject("checks not triggered"); }
        //             });
        //         });
        //     });
        //     it("activity-object", async () => {
        //         sc.online = true;
        //         let checked = false;
        //         await new Promise<void>((resolve, reject) => {
        //             socket.once("activity-object", (data, cb) => {
        //                 assertEquals(data, { actor: "bar" });
        //                 assertEquals(cb, () => {});
        //                 checked = true;
        //             });
        //             sc.socket.emit("activity-object", { actor: "bar" }, () => {
        //                 if (checked == true) { resolve(); }
        //                 else { reject("checks not triggered"); }
        //             });
        //         });
        //     });
        //     it("credentials", async () => {
        //         sc.online = true;
        //         let checked = false;
        //         await new Promise<void>((resolve, reject) => {
        //             socket.once("credentials", (data, cb) => {
        //                 assertEquals(data, { actor: "bar" });
        //                 assertEquals(cb, () => {});
        //                 checked = true;
        //             });
        //             sc.socket.emit("credentials", { actor: "bar" }, () => {
        //                 if (checked == true) { resolve(); }
        //                 else { reject("checks not triggered"); }
        //             });
        //         });
        //     });
    });
});
