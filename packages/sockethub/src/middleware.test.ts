import { expect } from 'chai';
import * as sinon from 'sinon';

import middleware from './middleware';

describe("middleware", () => {
  it("is a function", () => {
    expect(typeof middleware).to.be.equal('function');
  });
  it("only accepts functions", () => {
    expect(()=>{middleware(()=>{}, 'foobar')}).to.throw('middleware chain can only take other functions as arguments.');
  });
  it("calls each member of chain", (done) => {
    const callback = (data, cb) => { cb(data); };
    const funcs = [ sinon.spy(callback), sinon.spy(callback), sinon.spy(callback) ];
    const entry = middleware(...funcs);
    entry('foobar', (err) => {
      expect(err).to.be.undefined;
      funcs.unshift(callback);
      for (let i = 1; i < funcs.length; i++) {
        expect(funcs[i].calledOnce).to.be.true;
        expect(funcs[i].calledWith('foobar', funcs[i - 1]));
      }
      done();
    });
  });
  it("throws exception on error with no callback provided", () => {
    const callbackError = (data, cb) => { cb(new Error('some error')); };
    const funcs = [ sinon.spy(callbackError) ];
    const entry = middleware(...funcs);
    expect(()=>{entry('foobar');}).to.throw('some error');
  });
  it("aborts call stack on error", (done) => {
    const callback = (data, cb) => { cb(data); };
    const callbackError = (data, cb) => { cb(new Error('some error')); };
    const funcs = [ sinon.spy(callback), sinon.spy(callbackError), sinon.spy(callback) ];
    const entry = middleware(...funcs);
    entry('foobar', (err) => {
      expect(err instanceof Error).to.be.true;
      expect(funcs[0].calledOnce).to.be.true;
      expect(funcs[0].calledWith('foobar', callback));
      expect(funcs[1].calledOnce).to.be.true;
      expect(funcs[1].calledWith('foobar', funcs[0]));
      expect(funcs[2].calledOnce).to.be.false;
      done();
    })
  });
  it("completes as expected with last call on error", (done) => {
    const callback = (data, cb) => { cb(data); };
    const callbackError = (data, cb) => { cb(new Error('some error')); };
    const funcs = [ sinon.spy(callback), sinon.spy(callback), sinon.spy(callbackError) ];
    const entry = middleware(...funcs);
    entry('foobar', (err) => {
      expect(err instanceof Error).to.be.true;
      expect(funcs[0].calledOnce).to.be.true;
      expect(funcs[0].calledWith('foobar', callback));
      expect(funcs[1].calledOnce).to.be.true;
      expect(funcs[1].calledWith('foobar', funcs[0]));
      expect(funcs[2].calledOnce).to.be.true;
      expect(funcs[2].calledWith('foobar', funcs[1]));
      done();
    })
  });
  it("calls each member of chain (50)", (done) => {
    const callback = (data, cb) => { cb(data); };
    let funcs = [];
    for (let i = 0; i <= 50; i++) {
      funcs.push(sinon.spy(callback));
    }
    middleware(...funcs)('foo', (err) => {
      expect(err).to.be.undefined;
      funcs.unshift(callback);
      for (let i = 1; i < funcs.length; i++) {
        expect(funcs[i].calledOnce).to.be.true;
        expect(funcs[i].calledWith('foo', funcs[i - 1]));
      }
      done();
    });
  });
})