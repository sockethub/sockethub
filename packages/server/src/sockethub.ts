import debug from "debug";
import { Socket } from "socket.io";
import crypto from "@sockethub/crypto";
import { CredentialsStore } from "@sockethub/data-layer";

import init from "./bootstrap/init";
import middleware, { MiddlewareChainInterface } from "./middleware";
import createActivityObject from "./middleware/create-activity-object";
import expandActivityStream from "./middleware/expand-activity-stream";
import storeCredentials from "./middleware/store-credentials";
import validate from "./middleware/validate";
import janitor from "./janitor";
import listener from "./listener";
import ProcessManager from "./process-manager";
import nconf from "nconf";
import { IActivityStream } from "@sockethub/schemas";

const log = debug("sockethub:server:core");

function attachError(err, msg) {
  if (typeof msg !== "object") {
    msg = { context: "error" };
  }
  msg.error = err.toString();
  delete msg.sessionSecret;
  return msg;
}

class Sockethub {
  private readonly parentId: string;
  private readonly parentSecret1: string;
  private readonly parentSecret2: string;
  counter: number;
  platforms: Map<string, object>;
  status: boolean;
  processManager: ProcessManager;

  constructor() {
    this.platforms = init.platforms;
    this.status = false;
    this.parentId = crypto.randToken(16);
    this.parentSecret1 = crypto.randToken(16);
    this.parentSecret2 = crypto.randToken(16);
    this.processManager = new ProcessManager(
      this.parentId,
      this.parentSecret1,
      this.parentSecret2
    );
    log("session id: " + this.parentId);
  }

  /**
   * initialization of Sockethub starts here
   */
  boot() {
    if (this.status) {
      return log("Sockethub.boot() called more than once");
    } else {
      this.status = true;
    }

    log("active platforms: ", [...init.platforms.keys()]);
    listener.start(); // start external services
    janitor.start(); // start cleanup cycle
    log("registering handlers");
    listener.io.on("connection", this.handleIncomingConnection.bind(this));
  }

  async shutdown() {
    await janitor.stop();
  }

  private handleIncomingConnection(socket: Socket) {
    // session-specific debug messages
    const sessionLog = debug("sockethub:server:core:" + socket.id),
          sessionSecret = crypto.randToken(16),
          // stores instance is session-specific
          // stores = getSessionStore(this.parentId, this.parentSecret1, socket.id, sessionSecret);
          credentialsStore = new CredentialsStore(
            this.parentId,
            socket.id,
            this.parentSecret1 + sessionSecret,
            nconf.get("redis")
          );

    sessionLog(`socket.io connection`);

    socket.on("disconnect", () => {
      sessionLog("disconnect received from client");
    });

    socket.on(
      "credentials",
      middleware("credentials")
        .use(expandActivityStream)
        .use(validate("credentials", socket.id))
        .use(storeCredentials(credentialsStore) as MiddlewareChainInterface)
        .use((err, data, next) => {
          // error handler
          next(attachError(err, data));
        })
        .use((data, next) => {
          next();
        })
        .done()
    );

    // when new activity objects are created on the client side, an event is
    // fired and we receive a copy on the server side.
    socket.on(
      "activity-object",
      middleware("activity-object")
        .use(validate("activity-object", socket.id))
        .use(createActivityObject)
        .use((err, data, next) => {
          next(attachError(err, data));
        })
        .use((data, next) => {
          next();
        })
        .done()
    );

    socket.on(
      "message",
      middleware("message")
        .use(expandActivityStream)
        .use(validate("message", socket.id))
        .use((msg, next) => {
          // The platform thread must find the credentials on their own using the given
          // sessionSecret, which indicates that this specific session (socket
          // connection) has provided credentials.
          msg.sessionSecret = sessionSecret;
          next(msg);
        })
        .use((err, data, next) => {
          next(attachError(err, data));
        })
        .use(async (msg: IActivityStream, next) => {
          const platformInstance = this.processManager.get(
            msg.context,
            msg.actor.id,
            socket.id
          );
          // job validated and queued, stores socket.io callback for when job is completed
          const job = await platformInstance.jobQueue.add(socket.id, msg);
          if (job) {
            platformInstance.completedJobHandlers.set(job.title, next);
          } else {
            // failed to add job to queue, reject handler immediately
            msg.error = "failed to add job to queue";
            next(msg);
          }
        })
        .done()
    );
  }
}

export default Sockethub;
