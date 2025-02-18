import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformInterface,
    PlatformSchemaStruct,
    PlatformSession,
    StatelessPlatformConfig,
} from "@sockethub/schemas";

import packageJSON from "../package.json" with { type: "json" };

interface DummyPlatformConfig extends StatelessPlatformConfig {
    greeting: string;
}

export default class Dummy implements PlatformInterface {
    debug: Logger;
    config: DummyPlatformConfig = {
        persist: false,
        greeting: "Hello",
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
                        enum: ["echo", "fail", "greet"],
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

    greet(job: ActivityStream, cb: PlatformCallback) {
        job.target = job.actor;
        job.actor = {
            id: "dummy",
            type: "platform",
        };
        job.object.content = `${this.config.greeting} ${job.actor.name}`;
        cb(undefined, job);
    }

    cleanup(cb: PlatformCallback) {
        cb();
    }
}
