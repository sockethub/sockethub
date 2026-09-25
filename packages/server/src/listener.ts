import { existsSync } from "node:fs";
import * as HTTP from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { createLogger } from "@sockethub/logger";
import express, {
    type Express,
    type NextFunction,
    type Request,
    type Response,
} from "express";
import rateLimit from "express-rate-limit";
import { Server, type Socket } from "socket.io";
import config from "./config.js";
import { parseCorsOrigins } from "./cors.js";
import routes from "./routes.js";
import { EXAMPLES_PATH } from "./server-info.js";
import { resolveTrustProxy } from "./trust-proxy.js";
import { SOCKETHUB_VERSION } from "./version.js";

const require = createRequire(import.meta.url);

const log = createLogger("server:listener");
// initial details
log.info(`sockethub v${SOCKETHUB_VERSION}`);

/**
 * Handles the initialization and access of Sockethub resources.
 *
 *  - HTTP Server
 *  - Express (serves resources, the server info page and example routes)
 *  - Socket.io (bidirectional websocket communication)
 */
class Listener {
    app?: Express;
    io: Server;
    http: HTTP.Server;

    /**
     * Starts the services needed for Sockethub to operate. After this command completes,
     * the `http` and `io` class properties will be set.
     */
    start() {
        // initialize express and socket.io objects
        const app = Listener.initExpress();
        this.app = app;
        this.http = new HTTP.Server(app);
        this.io = new Server(this.http, {
            path: config.get("sockethub:path") as string,
            maxHttpBufferSize: config.get(
                "sockethub:maxPayloadBytes",
            ) as number,
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

        const httpActionsPath = config.get("httpActions:path");
        // An operator may configure the HTTP actions path under the examples
        // prefix. Those requests must reach their own route, which enforces
        // the configured `rateLimiter`, instead of the SPA fallback or the
        // examples file-access limiter below.
        const isHttpActionsPath = (reqPath: string) =>
            typeof httpActionsPath === "string" &&
            (reqPath === httpActionsPath ||
                reqPath.startsWith(`${httpActionsPath}/`));

        // Set up rate limiter to prevent DoS attacks on file system access
        const limiter = rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minute
            max: 60, // max 60 requests per windowMs
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => isHttpActionsPath(req.path),
        });

        // The examples app lives under its own prefix (its SvelteKit build
        // uses the same base path), leaving the root URL to the server info
        // page registered by the main Sockethub bootstrap.
        // `redirect: false` so a request for the bare prefix falls through to
        // the SPA fallback instead of a 301 to a trailing slash. Static files
        // are not rate limited: a single page load fetches dozens of chunks,
        // so the per-minute budget below would starve the app itself. Only
        // the fallback, which reads the filesystem for arbitrary paths, is.
        const examplesStatic = express.static(examplesPath, {
            redirect: false,
        });
        app.use(
            EXAMPLES_PATH,
            (req: Request, res: Response, next: NextFunction) => {
                // Inside a mounted handler `req.path` is relative to the mount.
                if (isHttpActionsPath(`${req.baseUrl}${req.path}`)) {
                    next();
                    return;
                }
                examplesStatic(req, res, next);
            },
        );

        const examplesIndex = path.join(examplesPath, "index.html");
        // SPA fallback: serve index.html for any unmatched GET below the
        // examples prefix. Express 5 / path-to-regexp v8 no longer accept
        // string wildcards, so match the prefix with a regex.
        app.get(
            /^\/examples(\/.*)?$/,
            limiter,
            (req: Request, res: Response, next: NextFunction) => {
                if (isHttpActionsPath(req.path)) {
                    next();
                    return;
                }
                log.debug(`examples request ${req.path}`);
                // The install location is not user input, so dot-segments in
                // it (~/.bun, ~/.nvm, ...) must not make `send` 404 the file.
                res.sendFile(examplesIndex, { dotfiles: "allow" });
            },
        );

        log.info(
            `examples served at http://${config.get("sockethub:host")}:${config.get(
                "sockethub:port",
            )}${EXAMPLES_PATH}`,
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
        return parseCorsOrigins(config.get("sockethub:cors:origin"));
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
        // Decides whether 'x-forwarded-for' is believed when express-rate-limit
        // keys a client; left at Express's `false` default, every request
        // behind a reverse proxy shares the proxy's IP and one rate-limit
        // bucket.
        const trustProxy = resolveTrustProxy(
            config.get("sockethub:trustProxy"),
            config.get("credentialCheck:reconnectIpSource"),
            config.get("credentialCheck:proxyHeader"),
        );
        app.set("trust proxy", trustProxy);
        if (trustProxy !== false) {
            log.info(`trusting proxy headers (trust proxy: ${trustProxy})`);
        }
        // templating engines
        app.set("view engine", "ejs");
        // Express bundles body-parser as express.urlencoded(); use it directly.
        app.use(express.urlencoded({ extended: true }));
        // JSON parsing is scoped to the HTTP actions POST route (see
        // registerHttpActionsRoutes) rather than applied globally, so its
        // lenient `strict: false` and `httpActions:maxPayloadBytes` limit do
        // not affect other routes. No other route consumes a JSON body.
        return app;
    }

    getApp(): Express {
        if (!this.app) {
            throw new Error("listener not started");
        }
        return this.app;
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
