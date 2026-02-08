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
    private readonly log: Logger;
    config: DummyPlatformConfig = {
        persist: false,
        greeting: "Hello",
    };

    constructor(session: PlatformSession) {
        this.log = session.log;
    }

    get schema(): PlatformSchemaStruct {
        return {
            name: "dummy",
            version: packageJSON.version,
            messages: {
                required: ["type"],
                properties: {
                    type: {
                        enum: [
                            "echo",
                            "fail",
                            "throw",
                            "greet",
                            "exit0",
                            "exit1",
                            "throwTypeError",
                            "throwReferenceError",
                            "sigterm",
                            "sigkill",
                            "hang",
                        ],
                    },
                },
            },
            credentials: {},
        };
    }

    /**
     * Stateless platforms are always ready to handle jobs.
     */
    isInitialized(): boolean {
        return true;
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

    throw(job: ActivityStream, cb: PlatformCallback) {
        cb(new Error(job.object.content));
    }

    exit0(_job: ActivityStream, _cb: PlatformCallback) {
        process.exit(0);
    }

    exit1(_job: ActivityStream, _cb: PlatformCallback) {
        process.exit(1);
    }

    throwTypeError(_job: ActivityStream, _cb: PlatformCallback) {
        setTimeout(() => {
            throw new TypeError("dummy type error");
        }, 0);
    }

    throwReferenceError(_job: ActivityStream, _cb: PlatformCallback) {
        setTimeout(() => {
            throw new ReferenceError("dummy reference error");
        }, 0);
    }

    sigterm(_job: ActivityStream, _cb: PlatformCallback) {
        process.kill(process.pid, "SIGTERM");
    }

    sigkill(_job: ActivityStream, _cb: PlatformCallback) {
        process.kill(process.pid, "SIGKILL");
    }

    hang(_job: ActivityStream, _cb: PlatformCallback) {
        const buf = new SharedArrayBuffer(4);
        const arr = new Int32Array(buf);
        Atomics.wait(arr, 0, 0, 60_000);
    }

    greet(job: ActivityStream, cb: PlatformCallback) {
        job.target = job.actor;
        job.actor = {
            id: "dummy",
            type: "platform",
        };
        job.object.content = `${this.config.greeting} ${job.object.content}`;
        cb(undefined, job);
    }

    cleanup(cb: PlatformCallback) {
        this.log.debug("cleanup");
        cb();
    }
}
