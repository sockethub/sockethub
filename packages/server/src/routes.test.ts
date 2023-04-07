import { expect } from "chai";
import * as sinon from "sinon";
import { existsSync } from "fs";

import routes, { basePaths, IRoutePaths } from "./routes";

describe("routes/base", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("can find each of the base files it serves", () => {
    Object.values(basePaths).forEach((fwd: string) => {
      try {
        expect(existsSync(fwd)).to.be.true;
      } catch (e) {
        throw new Error(`Unable to resolve path ${fwd}`);
      }
    });
  });

  it("adds base routes", () => {
    const app = {
      get: sinon.spy(),
    };
    // @ts-ignore
    routes.setup(app);
    sinon.assert.callCount(app.get, Object.keys(basePaths).length);
  });

  it("handles calls to base routes as expected", () => {
    let routeHandlers: any = {};
    let app = {
      get: (path: string | number, route: any) => {
        routeHandlers[path] = route;
      },
    };
    // @ts-ignore
    routes.setup(app);

    function verifyPathRoutes(pathMap: IRoutePaths) {
      Object.keys(pathMap).forEach((path) => {
        const res = {
          setHeader: sinon.spy(),
          sendFile: sinon.spy(),
        };
        expect(pathMap[path].endsWith(".ejs")).to.be.false;
        routeHandlers[path]({ url: path }, res);
        sinon.assert.called(res.setHeader);
        sinon.assert.calledWith(res.sendFile, pathMap[path]);
      });
    }
    verifyPathRoutes(basePaths);
  });
});
