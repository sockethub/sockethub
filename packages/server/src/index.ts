import Sockethub from "./sockethub.js";

const sockethub = new Sockethub();

export async function server() {
    process.once("uncaughtException", function (err) {
        console.log("UNCAUGHT EXCEPTION\n", err.stack);
        process.exit(1);
    });

    process.once("SIGTERM", function () {
        console.log("Received TERM signal. Exiting.");
        process.exit(0);
    });

    process.once("SIGINT", function () {
        console.log("Received INT signal. Exiting.");
        process.exit(0);
    });

    process.once("exit", async function () {
        await sockethub.shutdown();
    });

    await sockethub.boot();
}
