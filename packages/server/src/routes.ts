import path from "node:path";
import debug from "debug";

import { __dirname } from "./util.js";

const logger = debug("sockethub:server:routes");

export interface IRoutePaths {
    [key: string]: string;
}

export const basePaths: IRoutePaths = {
    "/sockethub-client.js": path.resolve(
        __dirname,
        "..",
        "res",
        "sockethub-client.js",
    ),
    "/sockethub-client.min.js": path.resolve(
        __dirname,
        "..",
        "res",
        "sockethub-client.min.js",
    ),
    "/socket.io.js": path.resolve(__dirname, "..", "res", "socket.io.js"),
};

function prepFileRoutes(pathMap) {
    const _routes = [];
    for (const key of Object.keys(pathMap)) {
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
    }
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
    setup: (app: unknown) => {
        baseRoutes.forEach(addRoute(app));
    },
};
export default routes;
