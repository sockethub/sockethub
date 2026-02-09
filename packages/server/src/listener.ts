import { existsSync, writeFileSync } from "node:fs";
import * as HTTP from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { createLogger } from "@sockethub/logger";
import bodyParser from "body-parser";
import express, { type Express, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
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
            cors: {
                origin: "*",
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
        app.get("*", limiter, (req: Request, res: Response) => {
            log.debug(`examples request ${req.path}`);
            res.sendFile(examplesIndex);
        });

        log.info(
            `examples served at http://${config.get("sockethub:host")}:${config.get(
                "sockethub:port",
            )}`,
        );
    }

    private startHttp() {
        this.http.listen(
            config.get("sockethub:port"),
            config.get("sockethub:host") as number,
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
        // use bodyParser
        app.use(bodyParser.urlencoded({ extended: true }));
        const jsonLimit = config.get("httpActions:maxPayloadBytes") ?? "100kb";
        app.use(bodyParser.json({ limit: jsonLimit }));
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

type EmitFunction = (type: string, data: unknown) => void;

export interface SocketInstance {
    id: string;
    emit: EmitFunction;
}

export async function getSocket(sessionId: string): Promise<SocketInstance> {
    const sockets: Array<SocketInstance> = await listener.io.fetchSockets();
    return new Promise((resolve, reject) => {
        for (const socket of sockets) {
            if (sessionId === socket.id) {
                return resolve(socket);
            }
        }
        return reject(`unable to find socket for sessionId ${sessionId}`);
    });
}

export default listener;
