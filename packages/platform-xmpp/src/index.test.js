import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import sinon from "sinon";

import XMPP from "./index.js";

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

const job = {
    connect: {
        context: "xmpp",
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
    "room-info": {
        actor: actor,
        target: target.partyroom,
    },
};

describe("XMPP", () => {
    let clientFake, xmlFake, clientObjectFake, xp;

    beforeEach(() => {
        clientObjectFake = {
            on: sinon.fake(),
            start: sinon.fake.resolves(),
            send: sinon.fake.resolves(),
            join: sinon.fake.resolves(),
            stop: sinon.fake.resolves()
        };
        clientFake = sinon.fake.returns(clientObjectFake);

        // Mock XML object with chainable .c() method for building stanzas
        const mockXmlElement = {
            name: "presence",
            attrs: {},
            children: [],
            c: sinon.fake.returns({
                name: "x",
                attrs: { xmlns: "http://jabber.org/protocol/muc" },
                parent: null
            }),
            getChild: sinon.fake((name, xmlns) => {
                if (name === "x" && xmlns === "http://jabber.org/protocol/muc") {
                    return { attrs: { xmlns: "http://jabber.org/protocol/muc" } };
                }
                return null;
            })
        };

        // Create a smart fake that returns complex object for presence, simple for others
        xmlFake = sinon.fake((elementName) => {
            if (elementName === "presence") {
                return mockXmlElement;
            }
            return undefined; // Default return for other elements
        });

        class TestXMPP extends XMPP {
            createClient() {
                this.__clientConstructor = clientFake;
            }
            createXml() {
                this.__xml = xmlFake;
            }
        }

        xp = new TestXMPP({
            id: actor,
            debug: sinon.fake(),
            sendToClient: sinon.fake(),
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("Successful initialization", () => {
        it("works as intended", (done) => {
            xp.connect(job.connect, credentials, () => {
                sinon.assert.calledOnce(clientFake);
                expect(xp.__client.on).toBeDefined();
                expect(xp.__client.start).toBeDefined();
                expect(xp.__client.send).toBeDefined();
                expect(xp.__client.send.callCount).toEqual(0);
                sinon.assert.calledOnce(clientObjectFake.start);
                sinon.assert.notCalled(xp.sendToClient);
                done();
            });
        });
    });

    describe("Bad initialization", () => {
        it("returns the existing __client object", (done) => {
            const dummyClient =  {
                foo: "bar",
                socket: {
                    writable: true
                },
                status: "online"
            };
            xp.__client = dummyClient
            xp.connect(job.connect, credentials, (d) => {
                console.log('result: ', d);
                expect(xp.__client).toEqual(dummyClient);
                sinon.assert.notCalled(clientFake);
                sinon.assert.notCalled(xp.sendToClient);
                // sinon.assert.calledOnce(clientFake);
                // sinon.assert.calledOnce(xp.sendToClient);
                done();
            });
        });

        it("deletes the __client property on failed connect", (done) => {
            clientObjectFake.start = sinon.fake.rejects("foo");
            xp.connect(job.connect, credentials, () => {
                expect(xp.__client).toBeUndefined();
                sinon.assert.notCalled(xp.sendToClient);
                done();
            });
        });
    });

    describe("Platform functionality", () => {
        beforeEach((done) => {
            xp.connect(job.join, credentials, () => done());
        });

        describe("#join", () => {
            it("calls xmpp.js correctly", (done) => {
                expect(xp.__client.send).toBeInstanceOf(Function);
                xp.join(job.join, () => {
                    sinon.assert.calledOnce(xp.__client.send);

                    // Verify MUC <x> element was created with correct namespace
                    sinon.assert.calledWith(xmlFake, "x", { xmlns: "http://jabber.org/protocol/muc" });

                    // Verify presence stanza was created with correct attributes
                    sinon.assert.calledWith(xmlFake, "presence", {
                        from: "testingham@jabber.net",
                        to: "partyroom@jabber.net/testing ham",
                    });

                    done();
                });
            });
        });

        describe("#leave", () => {
            it("calls xmpp.js correctly", (done) => {
                expect(xp.__client).toBeDefined();
                expect(xp.__client.send).toBeInstanceOf(Function);
                xp.leave(job.leave, () => {
                    sinon.assert.calledOnce(xp.__client.send);
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
            it("calls xmpp.js correctly", (done) => {
                expect(xp.__client).toBeDefined();
                expect(xp.__client.send).toBeInstanceOf(Function);
                xp.send(job.send.chat, () => {
                    sinon.assert.calledOnce(xp.__client.send);
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

            it("calls xmpp.js correctly for a groupchat", (done) => {
                xp.send(job.send.groupchat, () => {
                    sinon.assert.calledOnce(xp.__client.send);
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

            it("calls xmpp.js correctly for a message correction", (done) => {
                xp.send(job.send.correction, () => {
                    sinon.assert.calledOnce(xp.__client.send);
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
            it("calls xml() correctly for available", (done) => {
                xp.update(job.update.presenceOnline, () => {
                    sinon.assert.calledOnce(xp.__client.send);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "presence",
                        {},
                        {},
                        { status: "ready to chat" },
                    ]);
                    done();
                });
            });
            it("calls xml() correctly for unavailable", (done) => {
                xp.update(job.update.presenceUnavailable, () => {
                    sinon.assert.calledOnce(xp.__client.send);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "presence",
                        {},
                        { show: "away" },
                        { status: "eating popcorn" },
                    ]);
                    done();
                });
            });
            it("calls xml() correctly for offline", (done) => {
                xp.update(job.update.presenceOffline, () => {
                    sinon.assert.calledOnce(xp.__client.send);
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
            it("calls xmpp.js correctly", (done) => {
                xp["request-friend"](job["request-friend"], () => {
                    sinon.assert.calledOnce(xp.__client.send);
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
            it("calls xmpp.js correctly", (done) => {
                xp["remove-friend"](job["remove-friend"], () => {
                    sinon.assert.calledOnce(xp.__client.send);
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
            it("calls xmpp.js correctly", (done) => {
                xp["remove-friend"](job["remove-friend"], () => {
                    sinon.assert.calledOnce(xp.__client.send);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "presence",
                        {
                            type: "unsubscribe",
                            to: job["make-friend"].target["id"],
                        },
                    ]);
                    done();
                });
            });
        });

        describe("#query", () => {
            it("calls xmpp.js correctly", (done) => {
                xp.query(job.query, () => {
                    sinon.assert.calledOnce(xp.__client.send);
                    expect(xmlFake.getCall(0).args).toEqual([
                        "query",
                        { xmlns: "http://jabber.org/protocol/disco#items" },
                    ]);
                    expect(xmlFake.getCall(1).args).toEqual([
                        "iq",
                        {
                            id: "muc_id",
                            type: "get",
                            from: "testingham@jabber.net",
                            to: "partyroom@jabber.net",
                        },
                        undefined,
                    ]);
                    done();
                });
            });
        });

        describe("#room-info", () => {
            it("calls xmpp.js correctly", (done) => {
                xp.roomInfo(job["room-info"], () => {
                    sinon.assert.calledOnce(xp.__client.send);
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
            it("calls cleanup", (done) => {
                let cleanupCalled = false;
                xp.cleanup = (done) => {
                    cleanupCalled = true;
                    done();
                }
                xp.disconnect(job, () => {
                    expect(cleanupCalled).toEqual(true);
                    done()
                });
            })
        });

        describe("#cleanup", () => {
            it("calls client.stop", (done) => {
                expect(xp.config.initialized).toEqual(true);
                xp.cleanup(() => {
                    expect(xp.config.initialized).toEqual(false);
                    sinon.assert.calledOnce(xp.__client.stop);
                    done()
                });
            })
        });

        describe("#join", () => {
            it("creates correct MUC presence stanza with namespace", (done) => {
                const joinJob = {
                    actor: {
                        id: "testingham@jabber.net",
                        name: "Testing Ham"
                    },
                    target: {
                        id: "testroom@conference.jabber.net"
                    }
                };

                xp.join(joinJob, () => {
                    sinon.assert.calledOnce(xp.__client.send);

                    // Verify MUC <x> element was created with correct namespace
                    sinon.assert.calledWith(xmlFake, "x", { xmlns: "http://jabber.org/protocol/muc" });

                    // Verify presence stanza was created with correct attributes
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
