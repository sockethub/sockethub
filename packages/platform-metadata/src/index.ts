import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSession,
} from "@sockethub/schemas";
import { toError } from "@sockethub/util/error";
import { createGuardedDispatcher } from "@sockethub/util/net";
import ogs from "open-graph-scraper";
import { PlatformMetadataSchema } from "./schema";

export default class Metadata implements PlatformInterface {
    private readonly log: Logger;
    private dispatcher?: ReturnType<typeof createGuardedDispatcher>;
    config: PlatformConfig = {
        persist: false,
    };
    constructor(session: PlatformSession) {
        this.log = session.log;
    }

    /**
     * The SSRF-guarded undici dispatcher, created once per instance (its
     * `allowPrivateAddresses` setting comes from packageConfig, fixed before the
     * first job) and reused across fetches so connections/timers are pooled.
     */
    private getDispatcher(): ReturnType<typeof createGuardedDispatcher> {
        if (!this.dispatcher) {
            this.dispatcher = createGuardedDispatcher({
                allowPrivateAddresses:
                    this.config.allowPrivateAddresses === true,
            });
        }
        return this.dispatcher;
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
        // The server fetches whatever URL a client puts in actor.id, so guard
        // it against SSRF and oversized responses. open-graph-scraper forwards
        // `fetchOptions` to its undici fetch; the guarded dispatcher refuses to
        // connect to private/loopback/metadata addresses (including across
        // redirect hops) and caps the response body. The escape hatch is set
        // via packageConfig — see the package README.
        const dispatcher = this.getDispatcher();
        ogs({
            url: job.actor.id,
            // open-graph-scraper *replaces* (does not merge) the default URL
            // validator settings, so we restate the defaults and only relax
            // require_tld. This lets the scraper accept TLD-less hosts such as
            // `localhost` and intranet names. Private/loopback destinations are
            // blocked at the connection layer by the guarded dispatcher above.
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
            // biome-ignore lint/suspicious/noExplicitAny: ogs fetchOptions dispatcher
            fetchOptions: { dispatcher } as any,
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
                // open-graph-scraper rejects with { error, result }, but a
                // dispatcher/abort failure can reject with a plain Error. Handle
                // both so the real error is reported rather than throwing a
                // TypeError on `result.error`.
                cb(toError(data?.result?.error ?? data));
            });
    }

    cleanup(cb: PlatformCallback) {
        // Release the guarded dispatcher's pooled connections on shutdown.
        this.dispatcher?.close().catch(() => {});
        cb();
    }
}
