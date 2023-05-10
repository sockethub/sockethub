import { expect } from "chai";
import * as sinon from "sinon";

import middleware, { MiddlewareChain } from "./middleware";

describe("Middleware", () => {
    it("middleware() is a function", () => {
        expect(typeof middleware).to.be.equal("function");
    });

    it("returns a MiddlewareChain instance", () => {
        const mw = middleware("testa");
        expect(mw).to.be.instanceof(MiddlewareChain);
        const mwc = new MiddlewareChain("testa");
        expect(mw.name).to.be.eql(mwc.name);
    });

    it("only accepts functions", () => {
        const mw = middleware("test");
        expect(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            mw.use("foobar");
        }).to.throw("middleware use() can only take a function as an argument");
    });

    it("only accepts functions that expect 2 or 3 params", () => {
        const mw = middleware("test");
        expect(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            mw.use((one, two, three, four) => {});
        }).to.throw(
            "middleware function provided with incorrect number of params: 4",
        );
    });

    it("calls each member of call list", (done) => {
        const callback = (data: any, cb: (v: any) => void) => {
            cb(data);
        };
        const funcs = [
            sinon.spy(callback),
            sinon.spy(callback),
            sinon.spy(callback),
        ];
        const mw = middleware("test");
        for (const func of funcs) {
            mw.use(func);
        }
        mw.done()("some data", (data: any) => {
            expect(data).to.eql("some data");
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            funcs.unshift(callback);
            for (let i = 1; i < funcs.length; i++) {
                expect(funcs[i].calledOnce).to.be.true;
                expect(funcs[i].calledWith("foobar", funcs[i - 1]));
            }
            done();
        });
    });

    it("does not throw exception on error with no callback provided", (done) => {
        let errorHandlerCalled = false;
        const callbackError = (data: any, cb: (arg0: Error) => void) => {
            cb(new Error("some error"));
        };
        const funcs = [sinon.spy(callbackError)];
        const mw = middleware("test");
        for (const func of funcs) {
            mw.use(func);
        }
        mw.use((err: any, data: any, next: (v: string) => void) => {
            expect(err.toString()).to.equal("Error: some error");
            errorHandlerCalled = true;
            next(err);
        });
        mw.done()("foobar", () => {
            expect(errorHandlerCalled).to.be.true;
            done();
        });
    });

    it("aborts call stack on error - calls error handler, and callback", (done) => {
        let errorHandlerCalled = false;
        const callback = (data: any, cb: (v: any) => void) => {
            cb(data);
        };
        const callbackError = (data: any, cb: (arg0: Error) => void) => {
            cb(new Error("some error"));
        };
        const funcs = [
            sinon.spy(callback),
            sinon.spy(callbackError),
            sinon.spy(callback),
        ];
        const mw = middleware("test");
        for (const func of funcs) {
            mw.use(func);
        }
        mw.use((err: any, data: any, next: (v: any) => void) => {
            expect(err.toString()).to.equal("Error: some error");
            errorHandlerCalled = true;
            next(err);
        });
        mw.done()("foobar", (data: any) => {
            // FIXME -- We need to also handle socket.io callbacks!
            expect(data instanceof Error).to.be.true;
            expect(funcs[0].calledOnce).to.be.true;
            expect(funcs[0].calledWith("foobar", callback));
            expect(funcs[1].calledOnce).to.be.true;
            expect(funcs[1].calledWith("foobar", funcs[0]));
            expect(funcs[2].calledOnce).to.be.false;
            expect(errorHandlerCalled).to.be.true;
            done();
        });
    });

    it("error handler receives error and no callback provided", (done) => {
        let errorHandlerCalled = false;
        const callback = (data: any, cb: (v: any) => void) => {
            cb(data);
        };
        const callbackError = (data: any, cb: (arg0: Error) => void) => {
            cb(new Error("some error"));
        };
        const funcs = [
            sinon.spy(callback),
            sinon.spy(callback),
            sinon.spy(callbackError),
        ];
        const mw = middleware("test");
        for (const func of funcs) {
            mw.use(func);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        mw.use((err: any, data: any, next: (v: any) => void) => {
            expect(err instanceof Error).to.be.true;
            expect(err.toString()).to.equal("Error: some error");
            errorHandlerCalled = true;
            expect(funcs[0].calledOnce).to.be.true;
            expect(funcs[0].calledWith("foobar", callback));
            expect(funcs[1].calledOnce).to.be.true;
            expect(funcs[1].calledWith("foobar", funcs[0]));
            expect(funcs[2].calledOnce).to.be.true;
            expect(funcs[2].calledWith("foobar", funcs[1]));
            expect(errorHandlerCalled).to.be.true;
            setTimeout(done, 0);
        });
        mw.done()("foobar", () => {});
    });

    it("calls each member of chain (50)", (done) => {
        let errorHandlerCalled = false;
        const callback = (data: any, cb: (v: any) => void) => {
            cb(data);
        };
        const funcs: Array<any> = [];
        for (let i = 0; i <= 50; i++) {
            funcs.push(sinon.spy(callback));
        }
        const mw = middleware("test");
        for (const func of funcs) {
            mw.use(func);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        mw.use((err: any, data: any, next: (v: any) => void) => {
            expect(err.toString()).to.equal("Error: some error");
            errorHandlerCalled = true;
        });
        mw.done()("some data", (data: any) => {
            expect(data).to.equal("some data");
            funcs.unshift(callback);
            for (let i = 1; i < funcs.length; i++) {
                expect(funcs[i].calledOnce).to.be.true;
                expect(funcs[i].calledWith("foo", funcs[i - 1]));
            }
            expect(errorHandlerCalled).to.be.false;
            done();
        });
    });
});
