import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSession,
} from "@sockethub/schemas";
import ogs from "open-graph-scraper";
import { PlatformMetadataSchema } from "./schema";

export default class Metadata implements PlatformInterface {
    readonly debug: Logger;
    config: PlatformConfig = {
        persist: false,
    };
    constructor(session: PlatformSession) {
        this.debug = session.log;
    }

    get schema() {
        return PlatformMetadataSchema;
    }

    fetch(job: ActivityStream, cb: PlatformCallback) {
        this.debug.debug(`fetching ${job.actor.id}`);
        ogs({
            url: job.actor.id,
        })
            .then((data) => {
                const { result } = data;
                job.actor.id = result.ogUrl || job.actor.id;
                job.actor.name = result.ogSiteName || job.actor.name || "";
                job.object = {
                    type: "page",
                    language: result.ogLocale,
                    title: result.ogTitle,
                    name: result.ogSiteName,
                    description: result.ogDescription || "",
                    image: result.ogImage,
                    url: result.ogUrl,
                    favicon: result.favicon,
                    charset: result.charset,
                };
                cb(null, job);
            })
            .catch((data) => {
                const { result } = data;
                cb(result.error);
            });
    }

    cleanup(cb: PlatformCallback) {
        cb();
    }
}
