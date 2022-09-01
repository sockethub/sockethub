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

  it("calls each member of call list", async () => {
    const asyncFunc = async (data: any) => {
      return data;
    };
    const funcs = [ sinon.spy(asyncFunc), sinon.spy(asyncFunc), sinon.spy(asyncFunc) ];
    const mw = middleware('test');
    for (let func of funcs) {
      mw.use(func);
    }
    const doneFunc = mw.done()
    const data = await doneFunc('some data');
    expect(data).to.eql('some data');
    // @ts-ignore
    funcs.unshift(asyncFunc);
    for (let i = 1; i < funcs.length; i++) {
      expect(funcs[i].calledOnce).to.be.true;
      expect(funcs[i].calledWith('foobar'));
    }
  });

  it("does not throw exception on error with no callback provided", async () => {
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
    await doneFunc('foobar');
    expect(errorHandlerCalled).to.be.true;
  });

  it("aborts call stack on error - calls error handler, and callback", async () => {
    let errorHandlerCalled = false;
    const asyncFunc = async (data: any) => {
      return data;
    };
    const callbackError = (data: any) => {
      throw new Error('some error');
    };
    const funcs = [ sinon.spy(asyncFunc), sinon.spy(callbackError), sinon.spy(asyncFunc) ];
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
    try {
      await doneFunc('foobar');
    } catch (err) {
      expect(err instanceof Error).to.be.true;
    }
    // FIXME -- We need to also handle socket.io callbacks!
    expect(funcs[0].calledOnce).to.be.true;
    expect(funcs[0].calledWith('foobar'));
    expect(funcs[1].calledOnce).to.be.true;
    expect(funcs[1].calledWith('foobar'));
    expect(funcs[2].calledOnce).to.be.false;
    expect(errorHandlerCalled).to.be.true;
  });

  it("error handler receives error and no callback provided", async () => {
    let errorHandlerCalled = false;
    const asyncFunc = async (data: any): Promise<any> => {
      return data + 'l';
    };
    const callbackError = (data: any): Promise<any> => {
      throw new Error('some error');
    };
    const funcs = [ sinon.spy(asyncFunc), sinon.spy(asyncFunc), sinon.spy(callbackError) ];
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
      expect(errorHandlerCalled).to.be.true;
    });
    await mw.done()('foobar');
  });

  it("calls each member of chain (50)", async () => {
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
    const data = await mw.done()('some data');
    expect(data).to.equal('some data' + 'l'.repeat(50));
    funcs.unshift(asyncFunc);
    for (let i = 1; i < funcs.length; i++) {
      expect(funcs[i].calledOnce).to.be.true;
      expect(funcs[i].calledWith('foo', funcs[i - 1]));
    }
    expect(errorHandlerCalled).to.be.false;
  });
});