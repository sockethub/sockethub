import path from "path";
import debug from "debug";
import { Express, Request, Response } from "express";

const logger = debug("sockethub:server:routes");

export interface IRoutePaths {
  [key: string]: string;
}

enum Method {
  GET = "GET",
  POST = "POST",
}

type RouteMeta = {
  method: Method;
  path: string;
}

type RouteStruct = {
  meta: RouteMeta;
  route: (req: Request, res: Response) => void;
}

export const basePaths: IRoutePaths = {
  "/sockethub-client.js": path.resolve(
    __dirname, '..', 'node_modules', '@sockethub', 'client', 'dist', 'sockethub-client.js'
  ),
  "/sockethub-client.min.js": path.resolve(
    __dirname, '..', 'node_modules', '@sockethub', 'client', 'dist', 'sockethub-client.min.js'
  ),
  "/sockethub-client.js.map": path.resolve(
    __dirname, '..', 'node_modules', '@sockethub', 'client', 'dist', 'sockethub-client.js.map'
  ),
  "/socket.io.js": path.resolve(
    __dirname, '..', 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'
  ),
};

function prepFileRoutes(pathMap: IRoutePaths) {
  const _routes: Array<RouteStruct> = [];
  Object.keys(pathMap).forEach((key) => {
    _routes.push({
      meta: {
        method: Method.GET,
        path: key,
      },
      route: (req, res) => {
        logger(`serving resource ${req.url}`);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.sendFile(pathMap[req.url]);
      },
    });
  });
  return _routes;
}
const baseRoutes = prepFileRoutes(basePaths);

function addRoute(app: Express) {
  return (route: RouteStruct) => {
    const method: string = route.meta.method.toLowerCase();
    app[method as keyof typeof app](route.meta.path, route.route);
  };
}

/**
 * Setup
 */
const routes = {
  setup: function (app: Express) {
    baseRoutes.forEach(addRoute(app));
  },
};
export default routes;
