import ASFactory, { type ASFactoryOptions, type ASManager } from "./activity-streams.ts";
import type { ActivityActor, ActivityObject, ActivityStream } from "@sockethub/schemas"

import "https://deno.land/x/deno_mocha/global.ts";
import * as chai from "npm:chai";

const assert = chai.assert;
const expect = chai.expect;

interface MockActivityStream extends ActivityStream {
    [key: string]: ActivityObject | ActivityActor | string | undefined
}

describe("warn test", () => {
    assert.typeOf(ASFactory, "function");
    const activity: ASManager = ASFactory();

    it("rejects non-defined special types", () => {
        expect(() => {
            activity.Stream({
                type: "lol",
                platform: "irc",
                actor: "thingy",
                object: { type: "hola", content: "har", special: true },
                target: ["thingy1", "thingy2"],
            });
        }).to.throw(Error);
    });
});

describe("no special props", () => {
    assert.typeOf(ASFactory, "function");
    const activity: ASManager = ASFactory({ specialObjs: ["send"] });

    it("returns expected object with no special types", () => {
        const resp = activity.Stream({
            type: "send",
            context: "irc",
            actor: "thingy",
            object: { type: "hola", content: "har" },
            target: ["thingy1", "thingy2"],
        });
        expect(resp).to.eql({
            type: "send",
            context: "irc",
            actor: { id: "thingy" },
            object: { type: "hola", content: "har" },
            target: ["thingy1", "thingy2"],
        });
    });
});

describe("basic tests", () => {
    const config: ASFactoryOptions = {
        customProps: {
            credentials: ["secure"],
        },
        specialObjs: ["dude"],
        failOnUnknownObjectProperties: true,
    };
    const activity: ASManager = ASFactory(config);
    assert.typeOf(ASFactory, "function");

    describe("object tests", () => {
        it("has expected structure", () => {
            assert.typeOf(activity, "object");
            assert.typeOf(activity.Object, "object");
            assert.typeOf(activity.Stream, "function");
            assert.typeOf(activity.on, "function");
            assert.typeOf(activity.once, "function");
            assert.typeOf(activity.off, "function");
        });

        it("returns undefined when no params are passed", () => {
            const resp = activity.Object.get(undefined as unknown as string);
            assert.equal(resp, undefined);
        });

        it("returns object when given a valid lookup id", () => {
            expect(activity.Object.create({ id: "thingy1" })).to.deep.equal({
                id: "thingy1",
            });
            expect(activity.Object.get("thingy1")).to.deep.equal({
                id: "thingy1",
            });
        });

        it("throws an exception when called with no identifier", () => {
            expect(activity.Object.create).to.throw(Error);
        });

        it("creates a second object and returns is as expected", () => {
            expect(activity.Object.create({ id: "thingy2" })).to.deep.equal({
                id: "thingy2",
            });
            expect(activity.Object.get("thingy2")).to.deep.equal({
                id: "thingy2",
            });
        });

        it("returns a basic ActivtyObject when receiving an unknown id with expand=true", () => {
            expect(activity.Object.get("thingy3", true)).to.deep.equal({
                id: "thingy3",
            });
        });

        it("returns given id param when lookup fails and expand=false", () => {
            expect(
                activity.Object.get({
                    id: "thingy3",
                    type: "bar",
                } as ActivityStream),
            ).to.deep.equal({
                id: "thingy3",
                type: "bar",
            });
        });
    });

    describe("stream tests", () => {
        let stream: MockActivityStream;

        beforeEach(() => {
            stream = activity.Stream({
                verb: "lol",
                platform: "irc",
                actor: "thingy1",
                context: "irc",
                object: {
                    objectType: "credentials",
                    content: "har",
                    secure: true,
                },
                target: ["thingy1", "thingy2"],
            }) as MockActivityStream;
        });

        it("renames mapped props", () => {
            expect(stream.type).to.equal("lol");
            expect(stream.verb).to.not.exist;
            expect(stream.context).to.equal("irc");
            expect(stream.platform).to.not.exist;
        });

        it("expands existing objects", () => {
            expect(stream.target).to.deep.equal([
                { id: "thingy1" },
                { id: "thingy2" },
            ]);
            expect(stream.actor).to.deep.equal({ id: "thingy1" });
        });

        it("handles customProps as expected", () => {
            expect(stream.object).to.deep.equal({
                type: "credentials",
                content: "har",
                secure: true,
            });
            expect(stream.object?.objectType).to.not.exist;
        });

        it("respects specialObj properties", () => {
            const stream2 = activity.Stream({
                type: "lol",
                platform: "irc",
                actor: "thingy",
                object: {
                    type: "dude",
                    foo: "bar",
                    content: "har",
                    secure: true,
                },
                target: ["thingy1", "thingy2"],
            });
            expect(stream2).to.deep.equal({
                type: "lol",
                context: "irc",
                actor: { id: "thingy" },
                target: [{ id: "thingy1" }, { id: "thingy2" }],
                object: {
                    type: "dude",
                    foo: "bar",
                    content: "har",
                    secure: true,
                },
            });
        });

        it("rejects non-defined special types", () => {
            expect(() => {
                activity.Stream({
                    type: "lol",
                    platform: "irc",
                    actor: "thingy",
                    object: {
                        type: "hola",
                        foo: "bar",
                        content: "har",
                        secure: true,
                    },
                    target: ["thingy1", "thingy2"],
                });
            }).to.throw('invalid property: "foo"');
        });
    });

    describe("emitters", () => {
        it("emits an event on object creation", () => {
            function onHandler(obj: ActivityStream | ActivityObject) {
                expect(obj).to.deep.equal({ id: "thingy3" });
                activity.off("activity-object-create", onHandler);
            }
            activity.on("activity-object-create", onHandler);
            activity.Object.create({ id: "thingy3" });
        });

        it("emits an event on object deletion", () => {
            activity.once("activity-object-delete", (id: string) => {
                expect(id).to.equal("thingy2");
            });
            activity.Object.delete("thingy2");
        });
    });
});
