import Sockethub from "./sockethub";

const sockethub = new Sockethub();

module.exports = async () => {
  process.once("uncaughtException", function (err) {
    console.log("UNCAUGHT EXCEPTION");
    console.log(err.stack);
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
};
