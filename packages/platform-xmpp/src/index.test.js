const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;

const XMPP = require("./index.js");

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
};

describe("Platform", () => {
    let clientFake, xmlFake, clientObjectFake, xp;

    beforeEach(() => {
        clientObjectFake = {
            on: sinon.fake(),
            start: sinon.fake.resolves(),
            send: sinon.fake.resolves(),
            join: sinon.fake.resolves(),
        };
        clientFake = sinon.fake.returns(clientObjectFake);
        xmlFake = sinon.fake();

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
                expect(xp.__client.on).to.exist;
                expect(xp.__client.start).to.exist;
                expect(xp.__client.send).to.exist;
                expect(xp.__client.send.callCount).to.eql(0);
                sinon.assert.calledOnce(clientObjectFake.start);
                sinon.assert.notCalled(xp.sendToClient);
                done();
            });
        });
    });

    describe("Bad initialization", () => {
        it("returns the existing __client object", (done) => {
            xp.__client = "foo";
            xp.connect(job.connect, credentials, () => {
                expect(xp.__client).to.equal("foo");
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
                expect(xp.__client).to.be.undefined;
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
                expect(xp.__client.send).to.be.instanceof(Function);
                xp.join(job.join, () => {
                    sinon.assert.calledOnce(xp.__client.send);
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
                expect(xp.__client).to.not.be.undefined;
                expect(xp.__client.send).to.be.instanceof(Function);
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
                expect(xp.__client).to.not.be.undefined;
                expect(xp.__client.send).to.be.instanceof(Function);
                xp.send(job.send.chat, () => {
                    sinon.assert.calledOnce(xp.__client.send);
                    expect(xmlFake.getCall(0).args).to.eql([
                        "body",
                        {},
                        job.send.chat.object.content,
                    ]);
                    expect(xmlFake.getCall(1).args).to.eql([
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
                    expect(xmlFake.getCall(0).args).to.eql([
                        "body",
                        {},
                        job.send.groupchat.object.content,
                    ]);
                    expect(xmlFake.getCall(1).args).to.eql([
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
                    expect(xmlFake.getCall(0).args).to.eql([
                        "body",
                        {},
                        job.send.correction.object.content,
                    ]);
                    expect(xmlFake.getCall(1).args).to.eql([
                        "replace",
                        {
                            id: job.send.correction.object["xmpp:replace"].id,
                            xmlns: "urn:xmpp:message-correct:0",
                        },
                    ]);
                    expect(xmlFake.getCall(2).args).to.eql([
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
                    expect(xmlFake.getCall(0).args).to.eql([
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
                    expect(xmlFake.getCall(0).args).to.eql([
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
                    expect(xmlFake.getCall(0).args).to.eql([
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
                    expect(xmlFake.getCall(0).args).to.eql([
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
                    expect(xmlFake.getCall(0).args).to.eql([
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
                    expect(xmlFake.getCall(0).args).to.eql([
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
                    expect(xmlFake.getCall(0).args).to.eql([
                        "query",
                        { xmlns: "http://jabber.org/protocol/disco#items" },
                    ]);
                    expect(xmlFake.getCall(1).args).to.eql([
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
    });
});
