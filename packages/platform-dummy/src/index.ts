import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSchemaStruct,
    PlatformSession,
} from "@sockethub/schemas";

import packageJSON from "../package.json" with { type: "json" };

export default class Dummy implements PlatformInterface {
    debug: Logger;
    config: PlatformConfig = {
        persist: false,
    };

    constructor(session: PlatformSession) {
        this.debug = session.debug;
    }

    get schema(): PlatformSchemaStruct {
        return {
            name: "dummy",
            version: packageJSON.version,
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
