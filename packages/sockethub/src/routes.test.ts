import { expect } from 'chai';
import * as sinon from 'sinon';
import { existsSync } from "fs";

import routes, { basePaths, examplePaths, examplePages } from "./routes";

describe('routes/base', () => {

  afterEach(() => {
    sinon.restore();
  });

  it('can find each of the base files it serves', () => {
    Object.values(basePaths).forEach((fwd: string) => {
      try {
        expect(existsSync(fwd)).to.be.true;
      } catch (e) {
        throw new Error(`Unable to resolve path ${fwd}`);
      }
    });
  });

  it('can find each of the example files it serves', () => {
    Object.values(examplePaths).forEach((fwd: string) => {
      try {
        expect(existsSync(fwd)).to.be.true;
      } catch (e) {
        throw new Error(`Unable to resolve path ${fwd}`);
      }
    });
  });

  it('can find each of the example page files it serves', () => {
    Object.values(examplePages).forEach((fwd: string) => {
      try {
        expect(existsSync(fwd)).to.be.true;
      } catch (e) {
        throw new Error(`Unable to resolve path ${fwd}`);
      }
    });
  });

  it('adds base routes', () => {
    const app = {
      get: sinon.spy()
    };
    routes.setup(app, false);
    sinon.assert.callCount(
      app.get,
      Object.keys(basePaths).length
    );
  });

  it('adds base and example routes', () => {
    const app = {
      get: sinon.spy()
    };
    routes.setup(app, true);
    sinon.assert.callCount(
      app.get,
      Object.keys(basePaths).length
      + Object.keys(examplePaths).length
      + Object.keys(examplePages).length
    );
  });

  it('handles calls to base routes as expected', () => {
    let routeHandlers = {};
    let app = {
      get: (path, route) => {
        routeHandlers[path] = route;
      }
    };
    routes.setup(app, true);

    function verifyPathRoutes(pathMap) {
      Object.keys(pathMap).forEach((path) => {
        const res = {
          setHeader: sinon.spy(),
          sendFile: sinon.spy()
        };
        expect(pathMap[path].endsWith('.ejs')).to.be.false;
        routeHandlers[path]({url: path}, res);
        sinon.assert.called(res.setHeader);
        sinon.assert.calledWith(res.sendFile, pathMap[path]);
      });
    }
    verifyPathRoutes(basePaths);
    verifyPathRoutes(examplePaths);

    Object.keys(examplePages).forEach((path) => {
      const res = {
        render: sinon.spy()
      };
      expect(examplePages[path].endsWith('.ejs')).to.be.true;
      routeHandlers[path]({url: path}, res);
      sinon.assert.called(res.render);
    });
  });
});