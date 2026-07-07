import path from "node:path";
import { createLogger, initLogger, setLoggerContext } from "@sockethub/logger";
import { toError } from "@sockethub/util/error";
import type SockethubType from "./sockethub";
import { parseWriteConfigTarget, writeDefaultConfig } from "./write-config";

let sentry: { readonly reportError: (err: Error) => void } = {
    reportError: (_err: Error) => {},
};

export async function server() {
    // --write-config short-circuits startup: emit a default config file and
    // exit. Handled before the config modules load so it works even when an
    // existing config file in the working directory is invalid.
    const writeConfigTarget = parseWriteConfigTarget(process.argv.slice(2));
    if (writeConfigTarget !== undefined) {
        try {
            const message = writeDefaultConfig(writeConfigTarget);
            if (message) {
                console.log(message);
            }
            process.exit(0);
        } catch (err) {
            console.error(toError(err).message);
            process.exit(1);
        }
    }

    // Loaded lazily (not statically) so the import-time Config singleton
    // doesn't run for the --write-config path above.
    const { default: config } = await import("./config.js");
    const { default: Sockethub } = await import("./sockethub.js");

    // Initialize global logger configuration
    const loggingConfig = config.get("logging");
    const logFile = loggingConfig.file
        ? path.resolve(loggingConfig.file as string)
        : "";
    initLogger({
        level: loggingConfig.level,
        fileLevel: loggingConfig.fileLevel,
        file: logFile,
    });

    // Set process-wide context for all loggers
    setLoggerContext("sockethub");

    let sockethub: SockethubType;
    const log = createLogger("server:init");

    // conditionally initialize sentry
    if (config.get("sentry:dsn")) {
        log.info("initializing sentry");
        sentry = await import("./sentry");
    }

    try {
        sockethub = new Sockethub();
    } catch (err) {
        const error = toError(err);
        sentry.reportError(error);
        console.error(error);
        process.exit(1);
    }

    process.once("uncaughtException", (err: Error) => {
        console.error(
            `${(new Date()).toUTCString()} UNCAUGHT EXCEPTION\n`,
            err.stack,
        );
        sentry.reportError(err);
        process.exit(1);
    });

    process.once("unhandledRejection", (err: unknown) => {
        console.error(
            `${(new Date()).toUTCString()} UNHANDLED REJECTION\n`,
            err,
        );
        sentry.reportError(toError(err));
        process.exit(1);
    });

    const gracefulShutdown = async (signal: string) => {
        console.log(`Received ${signal} signal. Shutting down sockethub...`);
        try {
            await sockethub.shutdown();
            process.exit(0);
        } catch (err) {
            const error = toError(err);
            sentry.reportError(error);
            console.error(error);
            process.exit(1);
        }
    };

    process.once("SIGTERM", () => {
        gracefulShutdown("TERM");
    });

    process.once("SIGINT", () => {
        gracefulShutdown("INT");
    });

    try {
        await sockethub.boot();
    } catch (err) {
        const error = toError(err);
        sentry.reportError(error);
        console.error(error);
        process.exit(1);
    }
}
