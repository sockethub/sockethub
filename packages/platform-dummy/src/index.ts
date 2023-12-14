/* eslint-disable  @typescript-eslint/no-var-requires */
import {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSchemaStruct,
    PlatformSession,
} from "@sockethub/schemas";

class Dummy implements PlatformInterface {
    debug: Logger;

    constructor(session: PlatformSession) {
        this.debug = session.debug;
    }

    get schema(): PlatformSchemaStruct {
        return {
            name: "dummy",
            version: require("../package.json").version,
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

    get config(): PlatformConfig {
        return {
            persist: false,
        };
    }

    echo(job: ActivityStream, cb: PlatformCallback) {
        job.target = job.actor;
        job.actor = {
            id: "dummy",
            type: "platform",
        };
        cb(undefined, job);
    }

    fail(job: ActivityStream, cb: PlatformCallback) {
        cb(new Error(job.object.content));
    }

    cleanup(cb: PlatformCallback) {
        cb();
    }
}

module.exports = Dummy;
