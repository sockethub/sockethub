import {expect, describe, it, beforeEach} from "bun:test";
import * as sinon from "sinon";
import getInitObject, { __clearInit, IInitObject } from "./init.ts";
import { SinonStub } from "sinon";

describe("Init", () => {
    const initObject = {
        version: "init object",
        platforms: new Map(),
    } as IInitObject;
    let loadInitMock: SinonStub;

    beforeEach(() => {
        __clearInit();
        loadInitMock = sinon.stub().callsFake(async () => {
            return Promise.resolve(initObject);
        });
    });

    it("getInitObject calls __loadInit", async () => {
        const i = await getInitObject(loadInitMock);
        expect(i).toEqual(initObject);
        sinon.assert.calledOnce(loadInitMock);
    });

    it("__loadInit is only called once", async () => {
        await getInitObject(loadInitMock);
        await getInitObject(loadInitMock);
        await getInitObject(loadInitMock);
        await getInitObject(loadInitMock);
        const i = await getInitObject(loadInitMock);
        expect(i).toEqual(initObject);
        sinon.assert.calledOnce(loadInitMock);
    });
});
