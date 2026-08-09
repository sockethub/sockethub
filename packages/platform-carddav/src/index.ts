import { isDavCollectionChild } from "@sockethub/dav";
import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformInterface,
    PlatformSchemaStruct,
    PlatformSession,
    StatelessPlatformConfig,
} from "@sockethub/schemas";
import { buildCanonicalContext } from "@sockethub/schemas";
import { CardDavClient, CardDavFailure } from "./dav.js";
import { PlatformCardDavSchema } from "./schema.js";
import type {
    CardDavCredentials,
    ContactInput,
    ContactQuery,
    DeleteInput,
} from "./types.js";

const CONTEXT = buildCanonicalContext(PlatformCardDavSchema.contextUrl);

export default class CardDav implements PlatformInterface {
    private readonly log: Logger;
    config: StatelessPlatformConfig = {
        persist: false,
        requireCredentials: ["fetch", "query", "create", "update", "delete"],
        connectTimeoutMs: 15_000,
        allowPrivateAddresses: false,
        allowInsecureHttp: false,
        concurrency: 10,
    };

    constructor(session: PlatformSession) {
        this.log = session.log;
    }
    get schema(): PlatformSchemaStruct {
        return PlatformCardDavSchema;
    }
    isInitialized(): boolean {
        return true;
    }
    cleanup(done: PlatformCallback): void {
        done();
    }

    fetch(
        job: ActivityStream,
        credentials: CardDavCredentials,
        done: PlatformCallback,
    ): void {
        const client = this.client(credentials);
        client
            .discoverAddressBooks()
            .then((items) =>
                done(null, {
                    "@context": CONTEXT,
                    id: job.id ?? null,
                    type: "collection",
                    summary: "CardDAV address books",
                    totalItems: items.length,
                    items,
                } as never),
            )
            .catch((error) => this.fail(job, error, done))
            .finally(() => client.close().catch(() => {}));
    }

    query(
        job: ActivityStream,
        credentials: CardDavCredentials,
        done: PlatformCallback,
    ): void {
        const client = this.client(credentials);
        this.book(client, job.target?.id ?? "")
            .then((book) =>
                client.query(book, (job.object ?? {}) as ContactQuery),
            )
            .then((items) =>
                done(null, {
                    "@context": CONTEXT,
                    ...(job.id ? { id: job.id } : {}),
                    type: "collection",
                    summary: "CardDAV contacts",
                    totalItems: items.length,
                    items,
                } as never),
            )
            .catch((error) => this.fail(job, error, done))
            .finally(() => client.close().catch(() => {}));
    }

    create(
        job: ActivityStream,
        credentials: CardDavCredentials,
        done: PlatformCallback,
    ): void {
        const client = this.client(credentials);
        this.book(client, job.target?.id ?? "")
            .then((book) => client.create(book, job.object as ContactInput))
            .then((result) => done(null, this.mutation(job, "create", result)))
            .catch((error) => this.fail(job, error, done))
            .finally(() => client.close().catch(() => {}));
    }

    update(
        job: ActivityStream,
        credentials: CardDavCredentials,
        done: PlatformCallback,
    ): void {
        const client = this.client(credentials);
        const input = job.object as ContactInput & {
            id: string;
            uid: string;
            etag: string;
        };
        this.book(client, job.target?.id ?? "")
            .then((book) => {
                if (!isDavCollectionChild(book.id, input.id))
                    throw new CardDavFailure("carddav:invalid-resource");
                return client.update(input);
            })
            .then((result) => done(null, this.mutation(job, "update", result)))
            .catch((error) => this.fail(job, error, done))
            .finally(() => client.close().catch(() => {}));
    }

    delete(
        job: ActivityStream,
        credentials: CardDavCredentials,
        done: PlatformCallback,
    ): void {
        const client = this.client(credentials);
        const input = job.object as DeleteInput;
        this.book(client, job.target?.id ?? "")
            .then((book) => {
                if (!isDavCollectionChild(book.id, input.id))
                    throw new CardDavFailure("carddav:invalid-resource");
                return client.delete(input.id, input.etag);
            })
            .then(() =>
                done(null, this.mutation(job, "delete", { id: input.id })),
            )
            .catch((error) => this.fail(job, error, done))
            .finally(() => client.close().catch(() => {}));
    }

    private client(credentials: CardDavCredentials): CardDavClient {
        const { url, ...authentication } = credentials.object;
        return new CardDavClient(
            url,
            authentication,
            this.config.connectTimeoutMs,
            {
                allowPrivateAddresses: this.config.allowPrivateAddresses,
                allowInsecureHttp: this.config.allowInsecureHttp,
            },
        );
    }

    private async book(client: CardDavClient, id: string) {
        let normalized: string;
        try {
            normalized = new URL(id).href;
        } catch {
            throw new CardDavFailure("carddav:invalid-address-book");
        }
        const book = (await client.discoverAddressBooks()).find(
            (item) => item.id === normalized,
        );
        if (!book) throw new CardDavFailure("carddav:invalid-address-book");
        return book;
    }

    private mutation(
        job: ActivityStream,
        type: "create" | "update" | "delete",
        result: { id: string; uid?: string; etag?: string },
    ): ActivityStream {
        return {
            "@context": CONTEXT,
            ...(job.id ? { id: job.id } : {}),
            type,
            actor: job.actor,
            target: job.target,
            object: {
                id: result.id,
                type: "person",
                ...(result.uid ? { uid: result.uid } : {}),
                ...(result.etag ? { etag: result.etag } : {}),
            },
        } as ActivityStream;
    }

    private fail(
        job: ActivityStream,
        error: unknown,
        done: PlatformCallback,
    ): void {
        const code =
            error instanceof CardDavFailure
                ? error.code
                : `carddav:invalid-${job.type}: ${error instanceof Error ? error.message : String(error)}`;
        this.log.error(`CardDAV ${job.type} failed for actor ${job.actor.id}`, {
            code,
        });
        done(code);
    }
}

export { CardDavClient, CardDavFailure } from "./dav.js";
export { PlatformCardDavSchema } from "./schema.js";
export { buildVCard, parseVCard } from "./vcard.js";
