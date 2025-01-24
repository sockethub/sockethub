import ASFactory, {
    type ASFactoryOptions,
    type ASManager,
} from "./activity-streams.ts";
import type {
    ActivityActor,
    ActivityObject,
    ActivityStream,
} from "@sockethub/schemas";

import "https://deno.land/x/deno_mocha/global.ts";
import { expect } from "jsr:@std/expect";
import { assertInstanceOf } from "jsr:@std/assert";

interface MockActivityStream extends ActivityStream {
    [key: string]: ActivityObject | ActivityActor | string | undefined;
}

describe("warn test", () => {
    assertInstanceOf(ASFactory, Function);
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
        }).toThrow(Error);
    });
});

describe("no special props", () => {
    assertInstanceOf(ASFactory, Function);
    const activity: ASManager = ASFactory({ specialObjs: ["send"] });

    it("returns expected object with no special types", () => {
        const resp = activity.Stream({
            type: "send",
            context: "irc",
            actor: "thingy",
            object: { type: "hola", content: "har" },
            target: ["thingy1", "thingy2"],
        });
        expect(resp).toEqual({
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
    assertInstanceOf(ASFactory, Function);

    describe("object tests", () => {
        it("has expected structure", () => {
            assertInstanceOf(activity, Object);
            assertInstanceOf(activity.Object, Object);
            assertInstanceOf(activity.Stream, Function);
            assertInstanceOf(activity.on, Function);
            assertInstanceOf(activity.once, Function);
            assertInstanceOf(activity.off, Function);
        });

        it("returns undefined when no params are passed", () => {
            const resp = activity.Object.get(undefined as unknown as string);
            expect(resp).toEqual(undefined);
        });

        it("returns object when given a valid lookup id", () => {
            expect(activity.Object.create({ id: "thingy1" })).toEqual({
                id: "thingy1",
            });
            expect(activity.Object.get("thingy1")).toEqual({
                id: "thingy1",
            });
        });

        it("throws an exception when called with no identifier", () => {
            expect(activity.Object.create).toThrow(Error);
        });

        it("creates a second object and returns is as expected", () => {
            expect(activity.Object.create({ id: "thingy2" })).toEqual({
                id: "thingy2",
            });
            expect(activity.Object.get("thingy2")).toEqual({
                id: "thingy2",
            });
        });

        it("returns a basic ActivtyObject when receiving an unknown id with expand=true", () => {
            expect(activity.Object.get("thingy3", true)).toEqual({
                id: "thingy3",
            });
        });

        it("returns given id param when lookup fails and expand=false", () => {
            expect(
                activity.Object.get({
                    id: "thingy3",
                    type: "bar",
                } as ActivityStream),
            ).toEqual({
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
            expect(stream.type).toEqual("lol");
            expect(stream.verb).toBeUndefined();
            expect(stream.context).toEqual("irc");
            expect(stream.platform).toBeUndefined();
        });

        it("expands existing objects", () => {
            expect(stream.target).toEqual([
                { id: "thingy1" },
                { id: "thingy2" },
            ]);
            expect(stream.actor).toEqual({ id: "thingy1" });
        });

        it("handles customProps as expected", () => {
            expect(stream.object).toEqual({
                type: "credentials",
                content: "har",
                secure: true,
            });
            expect(stream.object?.objectType).toBeUndefined();
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
            expect(stream2).toEqual({
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
            }).toThrow('invalid property: "foo"');
        });
    });

    describe("emitters", () => {
        it("emits an event on object creation", () => {
            function onHandler(obj: ActivityStream | ActivityObject) {
                expect(obj).toEqual({ id: "thingy3" });
                activity.off("activity-object-create", onHandler);
            }
            activity.on("activity-object-create", onHandler);
            activity.Object.create({ id: "thingy3" });
        });

        it("emits an event on object deletion", () => {
            activity.once("activity-object-delete", (id: string) => {
                expect(id).toEqual("thingy2");
            });
            activity.Object.delete("thingy2");
        });
    });
});
