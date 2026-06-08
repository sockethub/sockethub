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
    private readonly log: Logger;
    config: PlatformConfig = {
        persist: false,
    };
    constructor(session: PlatformSession) {
        this.log = session.log;
    }

    get schema() {
        return PlatformMetadataSchema;
    }

    /**
     * Stateless platforms are always ready to handle jobs.
     */
    isInitialized(): boolean {
        return true;
    }

    fetch(job: ActivityStream, cb: PlatformCallback) {
        this.log.debug(`fetching ${job.actor.id}`);
        ogs({
            url: job.actor.id,
            // open-graph-scraper *replaces* (does not merge) the default URL
            // validator settings, so we restate the defaults and only relax
            // require_tld. This lets the scraper accept TLD-less hosts such as
            // `localhost` and intranet names. Note: the default validator already
            // accepts bare IPs, so this does not introduce a new SSRF class on its
            // own — see the SSRF hardening tracked separately.
            urlValidatorSettings: {
                allow_fragments: true,
                allow_protocol_relative_urls: false,
                allow_query_components: true,
                allow_trailing_dot: false,
                allow_underscores: false,
                protocols: ["http", "https"],
                require_host: true,
                require_port: false,
                require_protocol: false,
                require_tld: false,
                require_valid_protocol: true,
                validate_length: true,
            },
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
