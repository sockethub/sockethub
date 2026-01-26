import config from "./config";
import { createLogger } from "./logger";
import Sockethub from "./sockethub";

let sentry: { readonly reportError: (err: Error) => void } = {
    reportError: (err: Error) => {},
};

export async function server() {
    let sockethub: Sockethub;
    const log = createLogger("sockethub:init");

    // conditionally initialize sentry
    if (config.get("sentry:dsn")) {
        log.info("initializing sentry");
        sentry = await import("./sentry");
    }

    try {
        sockethub = new Sockethub();
    } catch (err) {
        sentry.reportError(err);
        console.error(err);
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

    process.once("unhandledRejection", (err: Error) => {
        console.error(
            `${(new Date()).toUTCString()} UNHANDLED REJECTION\n`,
            err,
        );
        sentry.reportError(err);
        process.exit(1);
    });

    process.once("SIGTERM", () => {
        console.log("Received TERM signal. Exiting.");
        process.exit(0);
    });

    process.once("SIGINT", () => {
        console.log("Received INT signal. Exiting.");
        process.exit(0);
    });

    process.once("exit", async () => {
        console.log("sockethub shutdown...");
        await sockethub.shutdown();
        process.exit(0);
    });

    try {
        await sockethub.boot();
    } catch (err) {
        sentry.reportError(err);
        console.error(err);
        process.exit(1);
    }
}
