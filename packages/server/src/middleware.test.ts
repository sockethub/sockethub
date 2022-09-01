import { expect } from 'chai';
import * as sinon from 'sinon';

import middleware, { MiddlewareChain } from "./middleware";

describe("Middleware", () => {
  it("middleware() is a function", () => {
    expect(typeof middleware).to.be.equal('function');
  });

  it('returns a MiddlewareChain instance', () => {
    const mw = middleware('testa');
    expect(mw).to.be.instanceof(MiddlewareChain);
    const mwc = new MiddlewareChain('testa');
    expect(mw.name).to.be.eql(mwc.name);
  });

  it("only accepts functions", () => {
    const mw = middleware('test');
    // @ts-ignore
    expect(()=>{mw.use('foobar');}).to.throw(
      'middleware use() can only take a function as an argument');
  });

  it("only accepts functions that expect 2 or 3 params", () => {
    const mw = middleware('test');
    // @ts-ignore
    expect(()=>{mw.use((one, two, three, four) => {});}).to.throw(
      'middleware function provided with incorrect number of params: 4');
  });

  it("calls each member of call list", (done) => {
    const asyncFunc = async (data: any) => {
      return data;
    };
    const funcs = [ sinon.spy(asyncFunc), sinon.spy(asyncFunc), sinon.spy(asyncFunc) ];
    const mw = middleware('test');
    for (let func of funcs) {
      mw.use(func);
    }
    const doneFunc = mw.done()
    doneFunc('some data', (data) => {
      expect(data).to.eql('some data');
      // @ts-ignore
      funcs.unshift(asyncFunc);
      for (let i = 1; i < funcs.length; i++) {
        expect(funcs[i].calledOnce).to.be.true;
        expect(funcs[i].calledWith('foobar'));
      }
      done();
    });
  });

  it("does not throw exception on error with no callback provided", (done) => {
    let errorHandlerCalled = false;
    const funcs = [
      sinon.spy((data) => {
        throw new Error('some error')
      })
    ];
    const mw = middleware('test');
    for (let func of funcs) {
      mw.use(func);
    }
    // error handler
    mw.use(async (err: any, data: any) => {
      expect(err.toString()).to.equal('Error: some error');
      errorHandlerCalled = true;
      return err;
    });
    const doneFunc = mw.done()
    doneFunc('foobar', () => {
      expect(errorHandlerCalled).to.be.true;
      done();
    });
  });

  it("aborts call stack on error - calls error handler, and callback", (done) => {
    let errorHandlerCalled = false;
    const asyncFunc = async (data: any) => {
      return data;
    };
    const asyncFuncError = (data: any) => {
      throw new Error('A Unique Error 3');
    };
    const funcs = [ sinon.spy(asyncFunc), sinon.spy(asyncFuncError), sinon.spy(asyncFunc) ];
    const mw = middleware('test');
    for (let func of funcs) {
      mw.use(func);
    }
    // error handler
    mw.use(async (err: any, data: any) => {
      expect(err.toString()).to.equal('Error: A Unique Error 3');
      errorHandlerCalled = true;
      return data;
    });
    mw.done()('foobar', (data) => {
      expect(funcs[0].calledOnce).to.be.true;
      expect(funcs[0].calledWith('foobar'));
      expect(funcs[1].calledOnce).to.be.true;
      expect(funcs[1].calledWith('foobar'));
      expect(funcs[2].calledOnce).to.be.false;
      expect(errorHandlerCalled).to.be.true;
      done();
    });
  });

  it("error handler receives error and no callback provided", (done) => {
    let errorHandlerCalled = false;
    const asyncFunc = async (data: any): Promise<any> => {
      return data + 'l';
    };
    const asyncFuncError = (data: any): Promise<any> => {
      throw new Error('some error');
    };
    const funcs = [ sinon.spy(asyncFunc), sinon.spy(asyncFunc), sinon.spy(asyncFuncError) ];
    const mw = middleware('test');
    for (let func of funcs) {
      mw.use(func);
    }
    // error handler
    mw.use(async (err: any, data: any): Promise<any> => {
      expect(err instanceof Error).to.be.true;
      expect(err.toString()).to.equal('Error: some error');
      errorHandlerCalled = true;
      expect(funcs[0].calledOnce).to.be.true;
      expect(funcs[0].calledWith('foobar'));
      expect(funcs[1].calledOnce).to.be.true;
      expect(funcs[1].calledWith('foobarl'));
      expect(funcs[2].calledOnce).to.be.true;
      expect(funcs[2].calledWith('foobarll'));
      return data;
    });
    mw.done()('foobar', (res) => {
      expect(errorHandlerCalled).to.be.true;
      expect(res).to.equal('foobarll');
      done();
    });
  });

  it("calls each member of chain (50)", (done) => {
    let errorHandlerCalled = false;
    const asyncFunc = async (data: any): Promise<any> => {
      return data + 'l';
    };
    let funcs: Array<any> = [];
    for (let i = 0; i < 50; i++) {
      funcs.push(sinon.spy(asyncFunc));
    }
    const mw = middleware('test');
    for (let func of funcs) {
      mw.use(func);
    }
    mw.use(async (err: any, data: any): Promise<any> => {
      expect(err.toString()).to.equal('Error: some error');
      errorHandlerCalled = true;
      return data;
    });
    mw.done()('some data', (data) => {
      expect(data).to.equal('some data' + 'l'.repeat(50));
      funcs.unshift(asyncFunc);
      for (let i = 1; i < funcs.length; i++) {
        expect(funcs[i].calledOnce).to.be.true;
        expect(funcs[i].calledWith('foo', funcs[i - 1]));
      }
      expect(errorHandlerCalled).to.be.false;
      done();
    });
  });
});