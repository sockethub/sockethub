import { expect } from 'chai';
import * as sinon from 'sinon';

import createMiddleware from "./middleware";

describe("Middleware", () => {
  it("createMiddleware() is a function", () => {
    expect(typeof createMiddleware).to.be.equal('function');
  });

  it("only accepts functions", () => {
    const mw = createMiddleware(()=>{});
    // @ts-ignore
    expect(()=>{mw(()=>{}, 'foobar');}).to.throw(
      'middleware chain can only take other functions as arguments.');
  });

  it("calls each member of call list", (done) => {
    const callback = (data, cb) => { cb(data); };
    const funcs = [ sinon.spy(callback), sinon.spy(callback), sinon.spy(callback) ];
    const mw = createMiddleware(()=>{});
    const entry = mw(...funcs);
    entry('foobar', (err) => {
      expect(err).to.be.null;
      funcs.unshift(callback);
      for (let i = 1; i < funcs.length; i++) {
        expect(funcs[i].calledOnce).to.be.true;
        expect(funcs[i].calledWith('foobar', funcs[i - 1]));
      }
      done();
    });
  });

  it("does not throw exception on error with no callback provided", (done) => {
    let errorHandlerCalled = false;
    const callbackError = (data, cb) => { cb(new Error('some error')); };
    const funcs = [ sinon.spy(callbackError) ];
    const mw = createMiddleware((err)=>{
      expect(err.toString()).to.equal('Error: some error');
      errorHandlerCalled = true;
    });
    const entry = mw(...funcs);
    entry('foobar');
    expect(errorHandlerCalled).to.be.true;
    done();
  });

  it("aborts call stack on error - calls error handler, and callback", (done) => {
    let errorHandlerCalled = false;
    const callback = (data, cb) => { cb(data); };
    const callbackError = (data, cb) => { cb(new Error('some error')); };
    const funcs = [ sinon.spy(callback), sinon.spy(callbackError), sinon.spy(callback) ];
    const mw = createMiddleware((err, msg) => {
      expect(err.toString()).to.equal('Error: some error');
      errorHandlerCalled = true;
    });
    const entry = mw(...funcs);
    entry('foobar', (err) => {
      // FIXME -- We need to also handle socket.io callbacks!
      expect(err instanceof Error).to.be.true;
      expect(funcs[0].calledOnce).to.be.true;
      expect(funcs[0].calledWith('foobar', callback));
      expect(funcs[1].calledOnce).to.be.true;
      expect(funcs[1].calledWith('foobar', funcs[0]));
      expect(funcs[2].calledOnce).to.be.false;
      expect(errorHandlerCalled).to.be.true;
      done();
    });
  });

  it("error handler receives error and no callback provided", (done) => {
    let errorHandlerCalled = false;
    const callback = (data, cb) => { cb(data); };
    const callbackError = (data, cb) => { cb(new Error('some error')); };
    const funcs = [ sinon.spy(callback), sinon.spy(callback), sinon.spy(callbackError) ];
    const mw = createMiddleware((err, msg) => {
      expect(err instanceof Error).to.be.true;
      expect(err.toString()).to.equal('Error: some error');
      errorHandlerCalled = true;
      expect(funcs[0].calledOnce).to.be.true;
      expect(funcs[0].calledWith('foobar', callback));
      expect(funcs[1].calledOnce).to.be.true;
      expect(funcs[1].calledWith('foobar', funcs[0]));
      expect(funcs[2].calledOnce).to.be.true;
      expect(funcs[2].calledWith('foobar', funcs[1]));
      expect(errorHandlerCalled).to.be.true;
      setTimeout(done, 0);
    });
    const entry = mw(...funcs);
    entry('foobar');
  });

  it("calls each member of chain (50)", (done) => {
    let errorHandlerCalled = false;
    const callback = (data, cb) => { cb(data); };
    let funcs = [];
    for (let i = 0; i <= 50; i++) {
      funcs.push(sinon.spy(callback));
    }
    const mw = createMiddleware((err, msg) => {
      expect(err.toString()).to.equal('Error: some error');
      errorHandlerCalled = true;
    });
    mw(...funcs)('foo', (err) => {
      expect(err).to.be.null;
      funcs.unshift(callback);
      for (let i = 1; i < funcs.length; i++) {
        expect(funcs[i].calledOnce).to.be.true;
        expect(funcs[i].calledWith('foo', funcs[i - 1]));
      }
      expect(errorHandlerCalled).to.be.false;
      done();
    });
  });
});