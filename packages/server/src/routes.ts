import path from "node:path";
import { createLogger } from "@sockethub/logger";
import type { Express, Request, Response } from "express";
import { __dirname } from "./util.js";

const logger = createLogger("server:routes");

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

type RouteDefinition = {
    meta: {
        method: "GET";
        path: string;
    };
    route: (req: Request, res: Response) => void;
};

function prepFileRoutes(pathMap: IRoutePaths): Array<RouteDefinition> {
    const _routes: Array<RouteDefinition> = [];
    for (const key of Object.keys(pathMap)) {
        _routes.push({
            meta: {
                method: "GET",
                path: key,
            },
            route: (req: Request, res: Response) => {
                logger.debug(`serving resource ${req.url}`);
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.sendFile(pathMap[req.url]);
            },
        });
    }
    return _routes;
}
const baseRoutes = prepFileRoutes(basePaths);

function addRoute(app: Express) {
    return (route: RouteDefinition) => {
        app.get(route.meta.path, route.route);
    };
}

/**
 * Setup
 */
const routes = {
    setup: (app: Express) => {
        baseRoutes.forEach(addRoute(app));
    },
};
export default routes;
