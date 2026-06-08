import { expect } from "@esm-bundle/chai";
import {
    ctx,
    emitWithAck,
    getConfig,
    platformIdFromContext,
    validateGlobals,
} from "../browser/shared-setup.js";

const config = getConfig();

/**
 * Contract tests assert platform response shapes match what the Sockethub client
 * and examples app expect. Failures here indicate a platform/client UI mismatch.
 */
describe(`Platform response contracts at ${config.sockethub.url}`, () => {
    validateGlobals();

    let sc;

    before(async () => {
        sc = new SockethubClient(
            io(config.sockethub.url, { path: "/sockethub" }),
        );
        await sc.ready();
    });

    after(() => {
        if (sc?.socket) {
            sc.socket.disconnect();
        }
    });

    function assertNoError(msg, label) {
        if (msg?.error) {
            throw new Error(`${label}: ${msg.error}`);
        }
    }

    function assertPlatformContext(msg, platform) {
        expect(msg).to.have.property("@context").that.is.an("array");
        expect(platformIdFromContext(msg["@context"])).to.equal(platform);
    }

    function assertCollectionContract(msg) {
        expect(msg.type).to.equal("collection");
        expect(msg).to.have.property("totalItems");
        expect(msg.totalItems).to.be.a("number");
        expect(msg).to.have.property("items");
        expect(msg.items).to.be.an("array");
        expect(msg.items.length).to.equal(msg.totalItems);
        expect(msg).to.have.property("summary").that.is.a("string");
        expect(msg).to.have.property("@context").that.is.an("array");
    }

    function assertFeedItemContract(item) {
        expect(item.type).to.equal("post");
        expect(item.actor).to.have.property("type", "feed");
        expect(item.actor).to.have.property("id").that.is.a("string");
        expect(item.object).to.be.an("object");
        expect(item.object)
            .to.have.property("type")
            .that.is.oneOf(["article", "note"]);
        expect(item.object).to.have.property("title").that.is.a("string");
        expect(item.object).to.have.property("id").that.is.a("string");
        expect(item.object).to.have.property("url").that.is.a("string");
        expect(item.object).to.have.property("content").that.is.a("string");
        expect(item.object)
            .to.have.property("contentType")
            .that.is.oneOf(["html", "text"]);
        expect(item.object).to.have.property("published");
        expect(item.object).to.have.property("datenum").that.is.a("number");
    }

    describe("feeds platform", () => {
        it("returns a collection contract the examples app can render", async () => {
            const msg = await emitWithAck(
                sc.socket,
                "message",
                {
                    "@context": ctx("feeds"),
                    type: "fetch",
                    actor: {
                        type: "feed",
                        id: `${config.sockethub.url}/feed.xml`,
                    },
                },
                { label: "feeds contract" },
            );

            assertNoError(msg, "feeds fetch");
            assertPlatformContext(msg, "feeds");
            assertCollectionContract(msg);

            for (const item of msg.items) {
                assertFeedItemContract(item);
            }
        });
    });

    describe("dummy platform", () => {
        const actor = {
            id: "contract-test@dummy",
            type: "person",
            name: "Contract Tester",
        };

        it("returns an echo response the client stores on the actor", async () => {
            const msg = await emitWithAck(
                sc.socket,
                "message",
                {
                    "@context": ctx("dummy"),
                    type: "echo",
                    actor,
                    object: {
                        type: "message",
                        content: "contract echo",
                    },
                },
                { label: "dummy echo contract" },
            );

            assertNoError(msg, "dummy echo");
            expect(msg.type).to.equal("echo");
            assertPlatformContext(msg, "dummy");
            expect(msg.actor).to.have.property("type", "platform");
            expect(msg.target).to.eql(actor);
            expect(msg.object).to.deep.include({
                type: "message",
                content: "contract echo",
            });
        });
    });

    describe("metadata platform", () => {
        it("returns page object fields the examples metadata view expects", async () => {
            const fixtureUrl = `${config.sockethub.url}/metadata-test.html`;
            const msg = await emitWithAck(
                sc.socket,
                "message",
                {
                    "@context": ctx("metadata"),
                    type: "fetch",
                    actor: {
                        type: "website",
                        id: fixtureUrl,
                    },
                },
                { label: "metadata contract" },
            );

            assertNoError(msg, "metadata fetch");
            expect(msg.type).to.equal("fetch");
            assertPlatformContext(msg, "metadata");
            expect(msg.actor).to.have.property("id").that.is.a("string");
            expect(msg.object).to.be.an("object");
            expect(msg.object).to.have.property("type", "page");
            expect(msg.object).to.have.property(
                "title",
                "Sockethub Metadata Test",
            );
            expect(msg.object).to.have.property("url", fixtureUrl);
            expect(msg.object).to.have.property(
                "description",
                "Local metadata fixture for integration tests",
            );
        });
    });
});
