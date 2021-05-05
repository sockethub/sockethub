import { existsSync } from "fs";

import routes, { basePaths, examplePaths, examplePages } from "./routes";

describe('routes/base', () => {
  it('can find each of the base files it serves', () => {
    Object.values(basePaths).forEach((fwd: string) => {
      try {
        expect(existsSync(fwd)).toBeTruthy();
      } catch (e) {
        throw new Error(`Unable to resolve path ${fwd}`);
      }
    });
  });

  it('can find each of the example files it serves', () => {
    Object.values(examplePaths).forEach((fwd: string) => {
      try {
        expect(existsSync(fwd)).toBeTruthy();
      } catch (e) {
        throw new Error(`Unable to resolve path ${fwd}`);
      }
    });
  });

  it('can find each of the example page files it serves', () => {
    Object.values(examplePages).forEach((fwd: string) => {
      try {
        expect(existsSync(fwd)).toBeTruthy();
      } catch (e) {
        throw new Error(`Unable to resolve path ${fwd}`);
      }
    });
  });

  it('adds base routes', () => {
    let app = {
      get: jest.fn()
    };
    routes.setup(app);
    expect(app['get']).toBeCalledTimes(Object.keys(basePaths).length);
  });

  it('adds base and example routes', () => {
    let app = {
      get: jest.fn()
    };
    routes.setup(app, true);
    expect(app['get']).toBeCalledTimes(
      Object.keys(basePaths).length + Object.keys(examplePaths).length + Object.keys(examplePages).length
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

    Object.keys(basePaths).forEach((path) => {
      const res = {
        setHeader: jest.fn(),
        sendFile: jest.fn()
      };
      routeHandlers[path]({url: path}, res);
      expect(res.setHeader).toHaveBeenCalled();
      expect(res.sendFile).toHaveBeenCalledWith(basePaths[path]);
    });

    Object.keys(examplePaths).forEach((path) => {
      const res = {
        setHeader: jest.fn(),
        sendFile: jest.fn()
      };
      routeHandlers[path]({url: path}, res);
      expect(res.setHeader).toHaveBeenCalled();
      expect(res.sendFile).toHaveBeenCalledWith(examplePaths[path]);
    });

    Object.keys(examplePages).forEach((path) => {
      const res = {
        render: jest.fn()
      };
      routeHandlers[path]({url: path}, res);
      expect(res.render).toHaveBeenCalled();
    });
  });
});