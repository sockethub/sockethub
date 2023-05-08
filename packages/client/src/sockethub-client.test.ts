// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import proxyquire from "proxyquire";
import { expect } from "chai";
import { createSandbox, restore } from "sinon";
import EventEmitter from "eventemitter3";

proxyquire.noPreserveCache();
proxyquire.noCallThru();

describe("SockethubClient bad initialization", () => {
  it("no socket.io instance", () => {
    const SockethubClient = proxyquire("./sockethub-client", {
      "@sockethub/activity-streams": (config: any) => {},
    }).default;
    expect(() => {
      const junk = new SockethubClient();
    }).to.throw("SockethubClient requires a socket.io instance");
  });
});

describe("SockethubClient", () => {
  let asinstance: any, socket: any, sc: any, sandbox: any;

  beforeEach(() => {
    sandbox = sandbox = createSandbox();
    socket = new EventEmitter();
    socket.__instance = "socketio"; // used to uniquely identify the object we're passing in
    sandbox.spy(socket, "on");
    sandbox.spy(socket, "emit");
    asinstance = new EventEmitter();
    sandbox.spy(asinstance, "on");
    sandbox.spy(asinstance, "emit");
    asinstance.Stream = sandbox.stub();
    asinstance.Object = {
      create: sandbox.stub(),
    };
    const SockethubClient = proxyquire("./sockethub-client", {
      "@sockethub/activity-streams": (config: any) => {
        return asinstance;
      },
    }).default;
    sc = new SockethubClient(socket);
    sandbox.spy(sc.socket, "on");
    sandbox.spy(sc.socket, "emit");
    sandbox.spy(sc.socket, "_emit");
  });

  afterEach(() => {
    restore();
  });

  it("contains the ActivityStreams property", () => {
    expect(asinstance).to.be.eql(sc.ActivityStreams);
    expect(typeof asinstance.Stream).to.equal("function");
    expect(typeof sc.ActivityStreams.Object.create).to.equal("function");
  });

  it("contains the socket property", () => {
    expect(sc.socket instanceof EventEmitter).to.be.true;
    // the object we passed in should not be the publically available one
    expect(sc.socket.__instance).to.not.equal("socketio");
    expect(sc.debug).to.be.true;
    expect(sc.online).to.be.false;
  });

  it("registers listeners for ActivityStream events", () => {
    expect(asinstance.on.callCount).to.equal(1);
    expect(asinstance.on.calledWithMatch("activity-object-create")).to.be.true;
  });

  it("registers a listeners for socket events", () => {
    expect(socket.on.callCount).to.equal(5);
    expect(socket.on.calledWithMatch("activity-object")).to.be.true;
    expect(socket.on.calledWithMatch("connect")).to.be.true;
    expect(socket.on.calledWithMatch("connect_error")).to.be.true;
    expect(socket.on.calledWithMatch("disconnect")).to.be.true;
    expect(socket.on.calledWithMatch("message")).to.be.true;
  });

  describe("event handling", () => {
    it("activity-object", (done) => {
      socket.emit("activity-object", { foo: "bar" });
      setTimeout(() => {
        sandbox.assert.calledWith(asinstance.Object.create, { foo: "bar" });
        done();
      }, 0);
    });

    it("activity-object-create", (done) => {
      asinstance.emit("activity-object-create", { foo: "bar" });
      setTimeout(() => {
        expect(socket.emit.callCount).to.equal(1);
        expect(socket.emit.calledWithMatch("activity-object", { foo: "bar" }))
          .to.be.true;
        done();
      }, 0);
    });

    it("connect", (done) => {
      expect(sc.online).to.be.false;
      sc.socket.on("connect", () => {
        expect(sc.online).to.be.true;
        expect(sc.socket._emit.callCount).to.equal(1);
        expect(sc.socket._emit.calledWithMatch("connect"));
        done();
      });
      socket.emit("connect");
    });

    it("disconnect", (done) => {
      sc.online = true;
      sc.socket.on("disconnect", () => {
        expect(sc.online).to.be.false;
        expect(sc.socket._emit.callCount).to.equal(1);
        expect(sc.socket._emit.calledWithMatch("disconnect"));
        done();
      });
      socket.emit("disconnect");
    });

    it("connect_error", (done) => {
      sc.socket.on("connect_error", () => {
        expect(sc.socket._emit.callCount).to.equal(1);
        expect(sc.socket._emit.calledWithMatch("connect_error"));
        done();
      });
      socket.emit("connect_error");
    });

    it("message", (done) => {
      sc.socket.on("message", () => {
        expect(sc.socket._emit.callCount).to.equal(1);
        expect(sc.socket._emit.calledWithMatch("message"));
        done();
      });
      socket.emit("message");
    });
  });

  describe("event emitting", () => {
    it("message (no actor)", () => {
      sc.online = true;
      const callback = () => {};
      expect(() => {
        sc.socket.emit("message", { foo: "bar" }, callback);
      }).to.throw("actor property not present");
    });

    it("message", (done) => {
      sc.online = true;
      const callback = () => {};
      socket.once("message", (data: any, cb: any) => {
        expect(data).to.be.eql({ actor: "bar", type: "bar" });
        expect(cb).to.be.eql(callback);
        done();
      });
      sc.socket.emit("message", { actor: "bar", type: "bar" }, callback);
    });

    it("message (join)", (done) => {
      sc.online = true;
      const callback = () => {};
      socket.once("message", (data: any, cb: any) => {
        expect(data).to.be.eql({ actor: "bar", type: "join" });
        expect(cb).to.be.eql(callback);
        done();
      });
      sc.socket.emit("message", { actor: "bar", type: "join" }, callback);
    });

    it("message (leave)", (done) => {
      sc.online = true;
      const callback = () => {};
      socket.once("message", (data: any, cb: any) => {
        expect(data).to.be.eql({ actor: "bar", type: "leave" });
        expect(cb).to.be.eql(callback);
        done();
      });
      sc.socket.emit("message", { actor: "bar", type: "leave" }, callback);
    });

    it("message (connect)", (done) => {
      sc.online = true;
      const callback = () => {};
      socket.once("message", (data: any, cb: any) => {
        expect(data).to.be.eql({ actor: "bar", type: "connect" });
        expect(cb).to.be.eql(callback);
        done();
      });
      sc.socket.emit("message", { actor: "bar", type: "connect" }, callback);
    });

    it("message (disconnect)", (done) => {
      sc.online = true;
      const callback = () => {};
      socket.once("message", (data: any, cb: any) => {
        expect(data).to.be.eql({ actor: "bar", type: "disconnect" });
        expect(cb).to.be.eql(callback);
        done();
      });
      sc.socket.emit("message", { actor: "bar", type: "disconnect" }, callback);
    });

    it("message (offline)", (done) => {
      sc.online = false;
      const callback = () => {};
      socket.once("message", (data: any, cb: any) => {
        expect(data).to.be.eql({ actor: "bar" });
        expect(cb).to.be.eql(callback);
        done();
      });
      sc.socket.emit("message", { actor: "bar" }, callback);
    });

    it("activity-object", (done) => {
      sc.online = true;
      const callback = () => {};
      socket.once("activity-object", (data: any, cb: any) => {
        expect(data).to.be.eql({ actor: "bar" });
        expect(cb).to.be.eql(callback);
        done();
      });
      sc.socket.emit("activity-object", { actor: "bar" }, callback);
    });

    it("credentials", (done) => {
      sc.online = true;
      const callback = () => {};
      socket.once("credentials", (data: any, cb: any) => {
        expect(data).to.be.eql({ actor: "bar" });
        expect(cb).to.be.eql(callback);
        done();
      });
      sc.socket.emit("credentials", { actor: "bar" }, callback);
    });
  });
});
