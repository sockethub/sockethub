import Sockethub from "./sockethub.js";

const sockethub = new Sockethub();

export async function server() {
    process.once("uncaughtException", (err) => {
        console.log("UNCAUGHT EXCEPTION\n", err.stack);
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
        await sockethub.shutdown();
    });

    await sockethub.boot();
}
