import path from "path";
import debug from "debug";

const logger = debug("sockethub:server:routes");

export interface IRoutePaths {
  [key: string]: string;
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

function prepFileRoutes(pathMap) {
  const _routes = [];
  Object.keys(pathMap).forEach((key) => {
    _routes.push({
      meta: {
        method: "GET",
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

function addRoute(app) {
  return (route) => {
    app[route.meta.method.toLowerCase()](route.meta.path, route.route);
  };
}

/**
 * Setup
 */
const routes = {
  setup: function (app: unknown) {
    baseRoutes.forEach(addRoute(app));
  },
};
export default routes;
