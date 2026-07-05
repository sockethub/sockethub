import { existsSync, writeFileSync } from "node:fs";
import * as HTTP from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { createLogger } from "@sockethub/logger";
import express, { type Express, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { Server, type Socket } from "socket.io";
import config from "./config.js";
import routes from "./routes.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

const log = createLogger("server:listener");
// initial details
log.info(`sockethub v${packageJson.version}`);

/**
 * Handles the initialization and access of Sockethub resources.
 *
 *  - HTTP Server
 *  - Express (serves resources and example routes)
 *  - Socket.io (bidirectional websocket communication)
 */
class Listener {
    io: Server;
    http: HTTP.Server;

    /**
     * Starts the services needed for Sockethub to operate. After this command completes,
     * the `http` and `io` class properties will be set.
     */
    start() {
        // initialize express and socket.io objects
        const app = Listener.initExpress();
        this.http = new HTTP.Server(app);
        this.io = new Server(this.http, {
            path: config.get("sockethub:path") as string,
            cors: {
                origin: Listener.corsOrigin(),
                methods: ["GET", "POST"],
            },
        });

        routes.setup(app);

        if (config.get("examples")) {
            this.addExamplesRoutes(app);
        }

        this.startHttp();
    }

    /**
     * Resolves the path to the examples static files from @sockethub/examples package.
     * Returns null if the package is not installed.
     */
    private resolveExamplesPath(): string | null {
        try {
            const examplesPkgPath = require.resolve(
                "@sockethub/examples/package.json",
            );
            const examplesDir = path.join(
                path.dirname(examplesPkgPath),
                "build",
            );
            if (existsSync(examplesDir)) {
                log.debug(
                    `examples resolved from @sockethub/examples: ${examplesDir}`,
                );
                return examplesDir;
            }
            log.debug(
                `@sockethub/examples found but build directory missing: ${examplesDir}`,
            );
            return null;
        } catch {
            return null;
        }
    }

    private addExamplesRoutes(app: Express) {
        const examplesPath = this.resolveExamplesPath();

        if (!examplesPath) {
            console.error(
                "\n❌ Error: --examples flag requires @sockethub/examples package\n\n" +
                    "The examples package is not installed. To use the examples feature, install it:\n\n" +
                    "  bun add @sockethub/examples\n\n" +
                    "Or run sockethub without the --examples flag.\n",
            );
            process.exit(1);
        }

        // Set up rate limiter to prevent DoS attacks on file system access
        const limiter = rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minute
            max: 60, // max 60 requests per windowMs
            standardHeaders: true,
            legacyHeaders: false,
        });

        // Write runtime config for the examples app
        writeFileSync(
            path.join(examplesPath, "config.json"),
            JSON.stringify({
                sockethub: config.get("sockethub"),
                public: config.get("public"),
            }),
        );

        app.use(express.static(examplesPath));

        const examplesIndex = path.join(examplesPath, "index.html");
        // SPA fallback: serve index.html for any unmatched GET. Express 5 /
        // path-to-regexp v8 no longer accept the bare "*" string path, so use a
        // regex that matches every path instead.
        app.get(/.*/, limiter, (req: Request, res: Response) => {
            log.debug(`examples request ${req.path}`);
            res.sendFile(examplesIndex);
        });

        log.info(
            `examples served at http://${config.get("sockethub:host")}:${config.get(
                "sockethub:port",
            )}`,
        );
    }

    /**
     * Resolve the socket.io CORS origin from config. Accepts '*' (default,
     * historical behavior), a single origin, or a comma-separated list.
     * Public deployments should set an explicit origin: with '*' any
     * website can connect visitors' browsers to this instance and use it
     * as a relay.
     */
    private static corsOrigin(): string | Array<string> {
        const configured = (
            (config.get("sockethub:cors:origin") as string) || "*"
        ).trim();
        if (configured === "*" || configured === "") {
            return "*";
        }
        const origins = configured
            .split(",")
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0);
        if (origins.length === 0) {
            return "*";
        }
        return origins.length === 1 ? origins[0] : origins;
    }

    private startHttp() {
        this.http.listen(
            config.get("sockethub:port"),
            config.get("sockethub:host") as string,
            () => {
                log.info(
                    `sockethub listening on ws://${config.get("sockethub:host")}:${config.get(
                        "sockethub:port",
                    )}`,
                );
            },
        );
    }

    private static initExpress(): Express {
        const app = express();
        // templating engines
        app.set("view engine", "ejs");
        // Express bundles body-parser as express.json()/express.urlencoded(),
        // so use those directly rather than the standalone dependency.
        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());
        return app;
    }
}

const listener = new Listener();

/**
 * O(1) lookup of a connected socket by session id (== socket.id). Returns
 * `undefined` when no such socket is connected (e.g. disconnected, awaiting
 * reconnect). Single socket.io server, no adapter, so the local map is
 * authoritative.
 */
export function getSocket(sessionId: string): Socket | undefined {
    return listener.io.sockets.sockets.get(sessionId);
}

export default listener;
