import path from "node:path";
import { createLogger, initLogger, setLoggerContext } from "@sockethub/logger";
import { toError } from "@sockethub/util/error";
import { parseInfoFlag, renderHelp } from "./cli.js";
import type SockethubType from "./sockethub";
import { SOCKETHUB_VERSION } from "./version.js";
import { parseWriteConfigTarget, writeDefaultConfig } from "./write-config";

let sentry: {
    readonly reportError: (err: Error) => void;
    readonly flush?: (timeoutMs?: number) => Promise<boolean>;
    readonly sendTestEvent?: () => Promise<boolean>;
} = {
    reportError: (_err: Error) => {},
};

/**
 * Report a fatal error and exit. Sentry sends events asynchronously, so the
 * queued event has to be flushed before `process.exit` tears the process down
 * — otherwise the crash that matters most is the one Sentry never sees.
 */
async function reportFatal(err: Error, code = 1): Promise<never> {
    sentry.reportError(err);
    try {
        // A false result means the timeout elapsed with the event still
        // queued. Report it rather than exiting as though it had been
        // delivered, but exit either way: a failing flush must never mask the
        // error being reported.
        if ((await sentry.flush?.()) === false) {
            console.error("fatal-error-flush timed out; event may be lost");
        }
    } catch (flushErr) {
        console.error(`fatal-error-flush failed: ${toError(flushErr).message}`);
    }
    process.exit(code);
}

export async function server() {
    const argv = process.argv.slice(2);

    // --help/--version short-circuit before anything else: they must answer
    // without loading config, binding a port, or initializing Sentry.
    //
    // These paths return rather than calling process.exit: writes to a pipe
    // are asynchronous, and a forced exit can truncate them mid-stream. There
    // is nothing holding the event loop open here, so returning exits just as
    // promptly, only after stdout has drained.
    const infoFlag = parseInfoFlag(argv);
    if (infoFlag === "help") {
        process.stdout.write(renderHelp());
        process.exitCode = 0;
        return;
    }
    if (infoFlag === "version") {
        console.log(SOCKETHUB_VERSION);
        process.exitCode = 0;
        return;
    }

    // --write-config short-circuits startup: emit a default config file and
    // exit. Handled before the config modules load so it works even when an
    // existing config file in the working directory is invalid.
    const writeConfigTarget = parseWriteConfigTarget(argv);
    if (writeConfigTarget !== undefined) {
        try {
            const message = writeDefaultConfig(writeConfigTarget);
            if (message) {
                console.log(message);
            }
            process.exitCode = 0;
        } catch (err) {
            console.error(toError(err).message);
            process.exitCode = 1;
        }
        return;
    }

    // Loaded lazily (not statically) so the import-time Config singleton
    // doesn't run for the --write-config path above.
    const { default: config } = await import("./config.js");

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

    // Registered as soon as Sentry is available and before the remaining
    // startup imports: a rejected import would otherwise leave `server()` to
    // reject with no handler attached, exiting without a report. Failures
    // before this point cannot reach Sentry in any case — the config that
    // carries the DSN has not been read yet.
    process.once("uncaughtException", (err: unknown) => {
        const error = toError(err);
        console.error(
            `${(new Date()).toUTCString()} UNCAUGHT EXCEPTION\n`,
            error.stack,
        );
        void reportFatal(error);
    });

    process.once("unhandledRejection", (err: unknown) => {
        console.error(
            `${(new Date()).toUTCString()} UNHANDLED REJECTION\n`,
            err,
        );
        void reportFatal(toError(err));
    });

    if (argv.includes("--sentry-test")) {
        if (!sentry.sendTestEvent) {
            console.error("Sentry is not configured; no test event was sent");
            process.exit(1);
        }
        const sent = await sentry.sendTestEvent();
        console.log(
            sent ? "Sentry test event sent" : "Sentry test event failed",
        );
        process.exit(sent ? 0 : 1);
    }

    // Exercises the fatal-error path itself — capture, flush, exit — which is
    // what a real crash takes and what --sentry-test does not cover. Runs
    // before the server is constructed, so it never contends for the port.
    if (argv.includes("--sentry-test-crash")) {
        if (!sentry.flush) {
            console.error("Sentry is not configured; no crash was reported");
            process.exit(1);
        }
        console.error("Reporting a synthetic fatal error to Sentry");
        await reportFatal(new Error("Sockethub Sentry verification crash"));
    }

    // Load the application graph only after Sentry so automatic tracing can
    // instrument Express, Socket.IO, Redis, and child-process dependencies.
    const { default: Sockethub } = await import("./sockethub.js");

    try {
        sockethub = new Sockethub();
    } catch (err) {
        const error = toError(err);
        console.error(error);
        await reportFatal(error);
    }

    const gracefulShutdown = async (signal: string) => {
        console.log(`Received ${signal} signal. Shutting down sockethub...`);
        try {
            await sockethub.shutdown();
            process.exit(0);
        } catch (err) {
            const error = toError(err);
            console.error(error);
            await reportFatal(error);
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
        console.error(error);
        await reportFatal(error);
    }
}
