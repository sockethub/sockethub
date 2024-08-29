import {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSchemaStruct,
    PlatformSession,
} from "@sockethub/schemas";

import denoJson from "./../deno.json" with { type: "json" };

/**
 * A simple Dummy sockethub platform, used as an example platform, and for
 * simple comms testing from client to server and back.
 */
export default class Dummy implements PlatformInterface {
    debug: Logger;
    config: PlatformConfig = {
        persist: false,
    };

    constructor(session: PlatformSession) {
        this.debug = session.debug;
    }

    /**
     * Returns the PlatformSchemaStruct of this platform, defining the available
     * methods (types) to call, name, version, and any credentials if applicable.
     */
    get schema(): PlatformSchemaStruct {
        return {
            name: "dummy",
            version: denoJson.version,
            messages: {
                required: ["type"],
                properties: {
                    type: {
                        enum: ["echo", "fail"],
                    },
                },
            },
            credentials: {},
        };
    }

    /**
     * Echo incoming AS Object back to client
     * @param job The incoming ActivityStream from the client
     * @param cb Complete the task
     */
    echo(job: ActivityStream, cb: PlatformCallback) {
        job.target = job.actor;
        job.actor = {
            id: "dummy",
            type: "platform",
        };
        cb(undefined, job);
    }

    /**
     * Return a failure back to client
     * @param job The incoming ActivityStream object from the client
     * @param cb Complete the task
     */
    fail(job: ActivityStream, cb: PlatformCallback) {
        cb(new Error(job.object!.content));
    }

    /**
     * When the platform should be destroyed this function is called in case there
     * is any in-platform cleanup to be done first.
     * @param cb Complete the task
     */
    cleanup(cb: PlatformCallback) {
        cb();
    }
}
