import { expect } from "chai";
import * as sinon from "sinon";
import getInitObject, { __clearInit, IInitObject } from "./init";
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
    expect(i).to.eql(initObject);
    sinon.assert.calledOnce(loadInitMock);
  });

  it("__loadInit is only called once", async () => {
    getInitObject(loadInitMock);
    getInitObject(loadInitMock);
    getInitObject(loadInitMock);
    getInitObject(loadInitMock);
    const i = await getInitObject(loadInitMock);
    expect(i).to.eql(initObject);
    sinon.assert.calledOnce(loadInitMock);
  });
});
