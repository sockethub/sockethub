import proxyquire from 'proxyquire';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { EventEmitter2 } from 'eventemitter2';

proxyquire.noPreserveCache();
proxyquire.noCallThru();

describe("SockethubClient", () => {
  let ASManager, socket, sc, sandbox;

  beforeEach(() => {
    sandbox = sandbox = sinon.createSandbox();
    socket = new EventEmitter2();
    // @ts-ignore
    socket.__instance = 'socketio'; // used to uniquely identify the object we're passing in
    sandbox.spy(socket, 'on')
    sandbox.spy(socket, 'emit')
    ASManager = new EventEmitter2();
    sandbox.spy(ASManager, 'on');
    sandbox.spy(ASManager, 'emit');
    ASManager.Stream = sandbox.stub();
    ASManager.Object = {
      create: sandbox.stub()
    };
    const SockethubClient = proxyquire('./sockethub-client', {
      'activity-streams': (config: any) => {
        return ASManager;
      }
    });
    sc = new SockethubClient(socket);
    sandbox.spy(sc.socket, 'on');
    sandbox.spy(sc.socket, '_on');
    sandbox.spy(sc.socket, 'emit');
    sandbox.spy(sc.socket, '_emit');
  });

  afterEach(() => {
    sinon.restore();
  });

  it("contains the ActivityStreams property", () => {
    expect(sc.ActivityStreams).to.be.eql(ASManager);
  });

  it("contains the socket property", () => {
    expect(sc.socket instanceof EventEmitter2).to.be.true;
    // the object we passed in should not be the publically available one
    expect(sc.socket.__instance).to.not.equal('socketio');
  });

  it("registers listeners for ActivityStream events", () => {
    expect(ASManager.on.callCount).to.equal(1);
    expect(ASManager.on.calledWithMatch('activity-object-create')).to.be.true;
  });

  it("registers a listeners for socket events", () => {
    expect(socket.on.callCount).to.equal(5);
    expect(socket.on.calledWithMatch('activity-object')).to.be.true;
    expect(socket.on.calledWithMatch('connect')).to.be.true;
    expect(socket.on.calledWithMatch('connect_error')).to.be.true;
    expect(socket.on.calledWithMatch('disconnect')).to.be.true;
    expect(socket.on.calledWithMatch('message')).to.be.true;
  });

  describe("event handling", () => {
    it("activity-object", (done) => {
      socket.emit('activity-object', {foo:"bar"});
      setTimeout(() => {
        sandbox.assert.calledWith(ASManager.Object.create, {foo:"bar"})
        done();
      }, 0);
    });

    it("activity-object-create", (done) => {
      ASManager.emit('activity-object-create', {foo:"bar"});
      setTimeout(() => {
        expect(socket.emit.callCount).to.equal(1);
        expect(socket.emit.calledWithMatch('activity-object', {foo:"bar"})).to.be.true;
        done();
      }, 0);
    });

    it("connect", (done) => {
      expect(sc.online).to.be.false;
      sc.socket.on("connect", () => {
        expect(sc.online).to.be.true;
        expect(sc.socket._emit.callCount).to.equal(1);
        expect(sc.socket._emit.calledWithMatch('connect'));
        done();
      });
      socket.emit("connect");
    });

    it("disconnect", (done) => {
      sc.online = true;
      sc.socket.on("disconnect", () => {
        expect(sc.online).to.be.false;
        expect(sc.socket._emit.callCount).to.equal(1);
        expect(sc.socket._emit.calledWithMatch('disconnect'));
        done();
      });
      socket.emit("disconnect");
    });

    it("connect_error", (done) => {
      sc.socket.on("connect_error", () => {
        expect(sc.socket._emit.callCount).to.equal(1);
        expect(sc.socket._emit.calledWithMatch('connect_error'));
        done();
      });
      socket.emit("connect_error");
    });

    it("message", (done) => {
      sc.socket.on("message", () => {
        expect(sc.socket._emit.callCount).to.equal(1);
        expect(sc.socket._emit.calledWithMatch('message'));
        done();
      });
      socket.emit("message");
    });
  });

  describe("event emitting", () => {
    it("message", (done) => {
      sc.online = true;
      const callback = (res) => {};
      socket.once("message", (data, cb) => {
        expect(data).to.be.eql({actor: "bar"});
        expect(cb).to.be.eql(callback);
        done();
      });
      sc.socket.emit("message", {actor:"bar"}, callback);
    });
  });
});