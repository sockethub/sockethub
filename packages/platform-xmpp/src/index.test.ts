import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import sinon from "sinon";
import { buildCanonicalContext } from "@sockethub/schemas";

import XMPP from "./index.js";
import { PlatformSchema } from "./schema.js";
import type { XmppClientInstance, XmppElement } from "@xmpp/client";

const actor = {
    type: "person",
    id: "testingham@jabber.net",
    name: "testing ham",
};

const credentials = {
    actor: actor,
    object: {
        type: "credentials",
        userAddress: "testingham@jabber.net",
        password: "foobar",
        resource: "home",
    },
};

const target = {
    mrfoobar: {
        type: "person",
        id: "mrfoobar@jabber.net",
        name: "Mr FooBar",
    },
    partyroom: {
        type: "room",
        id: "partyroom@jabber.net",
    },
    roomuser: {
        type: "room",
        id: "partyroom@jabber.net/ms tut",
    },
};

const XMPP_CONTEXT = buildCanonicalContext(PlatformSchema.contextUrl);

const job = {
    connect: {
        "@context": XMPP_CONTEXT,
        type: "connect",
        actor: {
            id: "slvrbckt@jabber.net/Home",
            type: "person",
            name: "Nick Jennings",
            userName: "slvrbckt",
        },
    },
    join: {
        actor: actor,
        object: {
            type: "update",
            name: "Frank",
        },
        target: target.partyroom,
    },
    leave: {
        actor: actor,
        target: target.partyroom,
    },
    send: {
        chat: {
            actor: actor,
            object: {
                type: "message",
                id: "hc-1234abcd",
                content: "hello",
            },
            target: target.mrfoobar,
        },
        groupchat: {
            actor: actor,
            object: {
                type: "message",
                id: "hc-1234abcd",
                content: "hi all",
            },
            target: target.roomuser,
        },
        correction: {
            actor: actor,
            object: {
                type: "message",
                id: "hc-1234abcd",
                content: "hi yall",
                "xmpp:replace": { id: "hc-234bcde" },
            },
            target: target.roomuser,
        },
    },
    update: {
        presenceOnline: {
            actor: actor,
            object: {
                type: "presence",
                presence: "online",
                content: "ready to chat",
            },
        },
        presenceUnavailable: {
            actor: actor,
            object: {
                type: "presence",
                presence: "away",
                content: "eating popcorn",
            },
        },
        presenceOffline: {
            actor: actor,
            object: {
                type: "presence",
                presence: "offline",
                content: "",
            },
        },
    },
    "request-friend": {
        actor: actor,
        target: target.mrfoobar,
    },
    "remove-friend": {
        actor: actor,
        target: target.mrfoobar,
    },
    "make-friend": {
        actor: actor,
        target: target.mrfoobar,
    },
    query: {
        actor: actor,
        target: target.partyroom,
        object: {
            type: "attendance",
        },
    },
    queryRoomInfo: {
        actor: actor,
        target: target.partyroom,
        object: {
            type: "room-info",
        },
    },
};

describe("XMPP", () => {
    let clientFake: ReturnType<typeof sinon.fake>;
    let xmlFake: ReturnType<typeof sinon.fake>;
    let clientObjectFake: Partial<XmppClientInstance> & { on: ReturnType<typeof sinon.fake>; start: ReturnType<typeof sinon.fake>; send: ReturnType<typeof sinon.fake>; stop: ReturnType<typeof sinon.fake>; join: ReturnType<typeof sinon.fake>; removeAllListeners: ReturnType<typeof sinon.fake> };
    let xp: XMPP;

    beforeEach(() => {
        clientObjectFake = {
            on: sinon.fake(),
            start: sinon.fake.resolves(),
            send: sinon.fake.resolves(),
            join: sinon.fake.resolves(),
            stop: sinon.fake.resolves(),
            removeAllListeners: sinon.fake(),
        };
        clientFake = sinon.fake.returns(clientObjectFake);

        const mockXmlElement: Partial<XmppElement> & { c: ReturnType<typeof sinon.fake>; getChild: ReturnType<typeof sinon.fake> } = {
            name: "presence",
            attrs: {},
            children: [],
            c: sinon.fake.returns({
                name: "x",
                attrs: { xmlns: "http://jabber.org/protocol/muc" },
                parent: null,
            }),
            getChild: sinon.fake((name: string, xmlns?: string) => {
                if (name === "x" && xmlns === "http://jabber.org/protocol/muc") {
                    return { attrs: { xmlns: "http://jabber.org/protocol/muc" } };
                }
                return null;
            }),
        };

        xmlFake = sinon.fake((elementName: string) => {
            if (elementName === "presence") {
                return mockXmlElement;
            }
            return undefined;
        });

        class TestXMPP extends XMPP {
            protected createClient(): void {
                this.__clientConstructor = clientFake as unknown as typeof this.__clientConstructor;
            }
            protected createXml(): void {
                this.__xml = xmlFake as unknown as typeof this.__xml;
            }
        }

        xp = new TestXMPP({
            id: actor.id,
            log: {
                error: sinon.fake(),
                warn: sinon.fake(),
                info: sinon.fake(),
                debug: sinon.fake(),
            },
            sendToClient: sinon.fake(),
            updateActor: sinon.fake.resolves(),
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("Successful initialization", () => {
        test("works as intended", (done) => {
            xp.connect(job.connect, credentials as never, () => {
                sinon.assert.calledOnce(clientFake);
                expect(xp.__client!.on).toBeDefined();
                expect(xp.__client!.start).toBeDefined();
                expect(xp.__client!.send).toBeDefined();
                expect((xp.__client!.send as ReturnType<typeof sinon.fake>).callCount).toEqual(0);
                sinon.assert.calledOnce(clientObjectFake.start);
                sinon.assert.notCalled(xp.sendToClient as ReturnType<typeof sinon.fake>);
                done();
            });
        });
    });

    describe("Bad initialization", () => {
        test("returns the existing __client object", (done) => {
            const dummyClient = {
                foo: "bar",
                socket: {
                    writable: true,
                },
                status: "online",
            };
            xp.__client = dummyClient as unknown as XmppClientInstance;
            xp.connect(job.connect, credentials as never, (d) => {
                console.log("result: ", d);
                expect(xp.__client).toEqual(dummyClient);
                sinon.assert.notCalled(clientFake);
                sinon.assert.notCalled(xp.sendToClient as ReturnType<typeof sinon.fake>);
                done();
            });
        });

        test("deletes the __client property on failed connect", (done) => {
            clientObjectFake.start = sinon.fake.rejects("foo");
            xp.connect(job.connect, credentials as never, () => {
                expect(xp.__client).toBeUndefined();
                sinon.assert.notCalled(xp.sendToClient as ReturnType<typeof sinon.fake>);
                done();
            });
        });
    });

    describe("Error handling", () => {
        let processExitStub: sinon.SinonStub;

        beforeEach(() => {
            processExitStub = sinon.stub(process, "exit");
        });

        afterEach(() => {
            processExitStub.restore();
        });

        test("terminates process on TypeError (internal code error)", (done) => {
            xp.connect(job.connect, credentials as never, () => {
                const errorHandler = clientObjectFake.on.getCalls().find(
                    (call: sinon.SinonSpyCall) => call.args[0] === "error",
                )!.args[1] as (err: Error) => void;

                const typeError = new TypeError("this.session.debug is not a function");
                errorHandler(typeError);

                sinon.assert.calledOnce(processExitStub);
                sinon.assert.calledWith(processExitStub, 1);

                sinon.assert.called(xp.log.error as ReturnType<typeof sinon.fake>);
                expect(
                    (xp.log.error as ReturnType<typeof sinon.fake>)
                        .getCalls()
                        .some((call: sinon.SinonSpyCall) =>
                            (call.args[0] as string).includes("FATAL: Internal code error"),
                        ),
                ).toBeTrue();

                done();
            });
        });

        test("terminates process on ReferenceError (internal code error)", (done) => {
            xp.connect(job.connect, credentials as never, () => {
                const errorHandler = clientObjectFake.on.getCalls().find(
                    (call: sinon.SinonSpyCall) => call.args[0] === "error",
                )!.args[1] as (err: Error) => void;

                const refError = new ReferenceError("foo is not defined");
                errorHandler(refError);

                sinon.assert.calledOnce(processExitStub);
                sinon.assert.calledWith(processExitStub, 1);
                sinon.assert.called(xp.log.error as ReturnType<typeof sinon.fake>);

                done();
            });
        });

        test("does NOT terminate process on network errors (recoverable)", (done) => {
            xp.connect(job.connect, credentials as never, () => {
                const errorHandler = clientObjectFake.on.getCalls().find(
                    (call: sinon.SinonSpyCall) => call.args[0] === "error",
                )!.args[1] as (err: Error & { code?: string }) => void;

                const networkError = Object.assign(new Error("ECONNRESET"), { code: "ECONNRESET" });
                errorHandler(networkError);

                sinon.assert.notCalled(processExitStub);
                sinon.assert.called(xp.sendToClient as ReturnType<typeof sinon.fake>);

                done();
            });
        });

        test("does NOT terminate process on XMPP protocol errors (non-recoverable)", (done) => {
            xp.connect(job.connect, credentials as never, () => {
                const errorHandler = clientObjectFake.on.getCalls().find(
                    (call: sinon.SinonSpyCall) => call.args[0] === "error",
                )!.args[1] as (err: Error & { condition?: string }) => void;

                const authError = Object.assign(new Error("not-authorized"), { condition: "not-authorized" });
                errorHandler(authError);

                sinon.assert.notCalled(processExitStub);
                sinon.assert.called(xp.sendToClient as ReturnType<typeof sinon.fake>);

                done();
            });
        });
    });

    describe("Platform functionality", () => {
        beforeEach((done) => {
            xp.connect(job.join as never, credentials as never, () => done());
        });

        describe("#join", () => {
            test("calls xmpp.js correctly", (done) => {
                expect(xp.__client!.send).toBeInstanceOf(Function);
                xp.join(job.join as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);

                    sinon.assert.calledWith(xmlFake, "x", { xmlns: "http://jabber.org/protocol/muc" });

                    sinon.assert.calledWith(xmlFake, "presence", {
                        from: "testingham@jabber.net",
                        to: "partyroom@jabber.net/testing ham",
                    });

                    done();
                });
            });

            test("registers room bare JID in __knownRooms", (done) => {
                expect(xp.__knownRooms.has("partyroom@jabber.net")).toBeFalse();
                xp.join(job.join as never, () => {
                    expect(xp.__knownRooms.has("partyroom@jabber.net")).toBeTrue();
                    done();
                });
            });

            test("strips resource from target JID before registering", (done) => {
                const jobWithResource = {
                    ...job.join,
                    target: { type: "room", id: "partyroom@jabber.net/someroom" },
                };
                xp.join(jobWithResource as never, () => {
                    expect(xp.__knownRooms.has("partyroom@jabber.net")).toBeTrue();
                    expect(xp.__knownRooms.has("partyroom@jabber.net/someroom")).toBeFalse();
                    done();
                });
            });
        });

        describe("#leave", () => {
            test("calls xmpp.js correctly", (done) => {
                expect(xp.__client).toBeDefined();
                expect(xp.__client!.send).toBeInstanceOf(Function);
                xp.leave(job.leave as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    sinon.assert.calledWith(xmlFake, "presence", {
                        from: "testingham@jabber.net",
                        to: "partyroom@jabber.net/testing ham",
                        type: "unavailable",
                    });
                    done();
                });
            });

            test("removes room bare JID from __knownRooms", (done) => {
                xp.__knownRooms.add("partyroom@jabber.net");
                xp.leave(job.leave as never, () => {
                    expect(xp.__knownRooms.has("partyroom@jabber.net")).toBeFalse();
                    done();
                });
            });

            test("strips resource from target JID before sending unavailable presence", (done) => {
                const jobWithResource = {
                    ...job.leave,
                    target: { type: "room", id: "partyroom@jabber.net/someroom" },
                };

                xp.leave(jobWithResource as never, () => {
                    sinon.assert.calledWith(xmlFake, "presence", {
                        from: "testingham@jabber.net",
                        to: "partyroom@jabber.net/testing ham",
                        type: "unavailable",
                    });
                    done();
                });
            });
        });

        describe("#send", () => {
            test("calls xmpp.js correctly", (done) => {
                expect(xp.__client).toBeDefined();
                expect(xp.__client!.send).toBeInstanceOf(Function);
                xp.send(job.send.chat as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "body",
                        {},
                        job.send.chat.object.content,
                    ]);
                    expect(xmlFake.getCall(1).args).toEqual([
                        "message",
                        {
                            type: "chat",
                            to: job.send.chat.target.id,
                            id: job.send.chat.object.id,
                        },
                        undefined,
                        undefined,
                    ]);
                    done();
                });
            });

            test("calls xmpp.js correctly for a groupchat", (done) => {
                xp.send(job.send.groupchat as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "body",
                        {},
                        job.send.groupchat.object.content,
                    ]);
                    expect(xmlFake.getCall(1).args).toEqual([
                        "message",
                        {
                            type: "groupchat",
                            to: job.send.groupchat.target.id,
                            id: job.send.groupchat.object.id,
                        },
                        undefined,
                        undefined,
                    ]);
                    done();
                });
            });

            test("calls xmpp.js correctly for a message correction", (done) => {
                xp.send(job.send.correction as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "body",
                        {},
                        job.send.correction.object.content,
                    ]);
                    expect(xmlFake.getCall(1).args).toEqual([
                        "replace",
                        {
                            id: job.send.correction.object["xmpp:replace"].id,
                            xmlns: "urn:xmpp:message-correct:0",
                        },
                    ]);
                    expect(xmlFake.getCall(2).args).toEqual([
                        "message",
                        {
                            type: "groupchat",
                            to: job.send.correction.target.id,
                            id: job.send.correction.object.id,
                        },
                        undefined,
                        undefined,
                    ]);
                    done();
                });
            });
        });

        describe("#update", () => {
            test("calls xml() correctly for available", (done) => {
                xp.update(job.update.presenceOnline as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "presence",
                        {},
                        {},
                        { status: "ready to chat" },
                    ]);
                    done();
                });
            });
            test("calls xml() correctly for unavailable", (done) => {
                xp.update(job.update.presenceUnavailable as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "presence",
                        {},
                        { show: "away" },
                        { status: "eating popcorn" },
                    ]);
                    done();
                });
            });
            test("calls xml() correctly for offline", (done) => {
                xp.update(job.update.presenceOffline as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "presence",
                        { type: "unavailable" },
                        {},
                        {},
                    ]);
                    done();
                });
            });
        });

        describe("#request-friend", () => {
            test("calls xmpp.js correctly", (done) => {
                xp["request-friend"](job["request-friend"] as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "presence",
                        {
                            type: "subscribe",
                            to: job["request-friend"].target["id"],
                        },
                    ]);
                    done();
                });
            });
        });

        describe("#remove-friend", () => {
            test("calls xmpp.js correctly", (done) => {
                xp["remove-friend"](job["remove-friend"] as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "presence",
                        {
                            type: "unsubscribe",
                            to: job["remove-friend"].target["id"],
                        },
                    ]);
                    done();
                });
            });
        });

        describe("#make-friend", () => {
            test("calls xmpp.js correctly", (done) => {
                xp["make-friend"](job["make-friend"] as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "presence",
                        {
                            type: "subscribe",
                            to: job["make-friend"].target["id"],
                        },
                    ]);
                    done();
                });
            });
        });

        describe("#query", () => {
            test("calls xmpp.js correctly for attendance query", (done) => {
                xp.query(job.query as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "query",
                        { xmlns: "http://jabber.org/protocol/disco#items" },
                    ]);
                    expect(xmlFake.getCall(1).args[0]).toEqual("iq");
                    expect(xmlFake.getCall(1).args[1].type).toEqual("get");
                    expect(xmlFake.getCall(1).args[1].from).toEqual("testingham@jabber.net");
                    expect(xmlFake.getCall(1).args[1].to).toEqual("partyroom@jabber.net");
                    expect(xmlFake.getCall(1).args[1].id).toMatch(/^attendance_/);
                    expect(xmlFake.getCall(1).args[2]).toBeUndefined();
                    done();
                });
            });

            test("calls xmpp.js correctly for room-info query", (done) => {
                xp.query(job.queryRoomInfo as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "query",
                        { xmlns: "http://jabber.org/protocol/disco#info" },
                    ]);
                    expect(xmlFake.getCall(1).args[0]).toEqual("iq");
                    expect(xmlFake.getCall(1).args[1].type).toEqual("get");
                    expect(xmlFake.getCall(1).args[1].from).toEqual("testingham@jabber.net");
                    expect(xmlFake.getCall(1).args[1].to).toEqual("partyroom@jabber.net");
                    expect(xmlFake.getCall(1).args[1].id).toMatch(/^room_info_/);
                    done();
                });
            });
        });

        describe("#disconnect", () => {
            test("calls cleanup", (done) => {
                let cleanupCalled = false;
                xp.cleanup = (done) => {
                    cleanupCalled = true;
                    done();
                };
                xp.disconnect(job as never, () => {
                    expect(cleanupCalled).toEqual(true);
                    done();
                });
            });
        });

        describe("#cleanup", () => {
            test("calls client.stop", (done) => {
                expect(xp.isInitialized()).toEqual(true);
                xp.__knownRooms.add("partyroom@jabber.net");
                const clientBeforeCleanup = xp.__client;
                xp.cleanup(() => {
                    expect(xp.isInitialized()).toEqual(false);
                    expect(xp.__knownRooms.has("partyroom@jabber.net")).toBeFalse();
                    expect(xp.__client).toBeUndefined();
                    sinon.assert.calledOnce(clientBeforeCleanup!.stop as ReturnType<typeof sinon.fake>);
                    sinon.assert.calledOnce(clientBeforeCleanup!.removeAllListeners as ReturnType<typeof sinon.fake>);
                    done();
                });
            });
        });

        describe("#join (MUC stanza)", () => {
            test("creates correct MUC presence stanza with namespace", (done) => {
                const joinJob = {
                    actor: {
                        id: "testingham@jabber.net",
                        name: "Testing Ham",
                        type: "person",
                    },
                    target: {
                        id: "testroom@conference.jabber.net",
                        type: "room",
                    },
                };

                xp.join(joinJob as never, () => {
                    sinon.assert.calledOnce(xp.__client!.send as ReturnType<typeof sinon.fake>);

                    sinon.assert.calledWith(xmlFake, "x", { xmlns: "http://jabber.org/protocol/muc" });

                    sinon.assert.calledWith(xmlFake, "presence", {
                        from: "testingham@jabber.net",
                        to: "testroom@conference.jabber.net/Testing Ham",
                    });

                    done();
                });
            });
        });
    });
});
