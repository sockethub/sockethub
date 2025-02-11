import { ASFactory } from "./activity-streams";
import { test, describe, beforeEach, expect } from "bun:test";

describe("warn test", () => {
    expect(typeof ASFactory).toEqual("function");
    const activity = ASFactory();
    test("rejects nondefined special types", () => {
        expect(() => {
            activity.Stream({
                type: "lol",
                platform: "irc",
                actor: "thingy",
                object: { type: "hola", content: "har", secure: true },
                target: ["thingy1", "thingy2"],
            });
        }).toThrow(Error);
    });
});

describe("no special props", () => {
    const activity = ASFactory();
    test("init", () => {
        expect(typeof ASFactory).toEqual("function");
    });

    test("returns expected object with no special types", () => {
        expect(
            activity.Stream({
                type: "send",
                context: "irc",
                actor: "thingy",
                object: { type: "hola", content: "har" },
                target: ["thingy1", "thingy2"],
            }),
        ).toEqual({
            type: "send",
            context: "irc",
            actor: { id: "thingy" },
            object: { type: "hola", content: "har" },
            target: ["thingy1", "thingy2"],
        });
    });
});

describe("basic tests", () => {
    const config = {
        customProps: {
            credentials: ["secure"],
        },
        specialObjs: ["dude"],
        failOnUnknownObjectProperties: true,
    };

    const activity = ASFactory(config);
    test("init", () => {
        expect(typeof ASFactory).toEqual("function");
    });

    describe("object tests", () => {
        test("has expected structure", () => {
            expect(typeof activity).toEqual("object");
            expect(typeof activity.Object).toEqual("object");
            expect(typeof activity.Stream).toEqual("function");
            expect(typeof activity.on).toEqual("function");
            expect(typeof activity.once).toEqual("function");
            expect(typeof activity.off).toEqual("function");
        });

        test("returns undefined when no params are passed", () => {
            expect(activity.Object.get()).toBeUndefined();
        });

        test("returns object when given a valid lookup id", () => {
            expect(activity.Object.create({ id: "thingy1" })).toEqual({
                id: "thingy1",
            });
            expect(activity.Object.get("thingy1")).toEqual({
                id: "thingy1",
            });
        });

        test("throws an exception when called with no identifier", () => {
            expect(activity.Object.create).toThrow(Error);
        });

        test("creates a second object and returns is as expected", () => {
            expect(activity.Object.create({ id: "thingy2" })).toEqual({
                id: "thingy2",
            });
            expect(activity.Object.get("thingy2")).toEqual({
                id: "thingy2",
            });
        });

        test("returns a basic ActivtyObject when receiving an unknown id with expand=true", () => {
            expect(activity.Object.get("thingy3", true)).toEqual({
                id: "thingy3",
            });
        });

        test("returns given id param when lookup fails and expand=false", () => {
            expect(
                activity.Object.get({
                    id: "thingy3",
                    foo: "bar",
                }),
            ).toEqual({
                id: "thingy3",
                foo: "bar",
            });
        });
    });

    describe("stream tests", () => {
        let stream;

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
            });
        });

        test("renames mapped props", () => {
            expect(stream.type).toEqual("lol");
            expect(stream.verb).toBeUndefined();
            expect(stream.context).toEqual("irc");
            expect(stream.platform).toBeUndefined();
        });

        test("expands existing objects", () => {
            expect(stream.target).toEqual([
                { id: "thingy1" },
                { id: "thingy2" },
            ]);
            expect(stream.actor).toEqual({ id: "thingy1" });
        });

        test("handles customProps as expected", () => {
            expect(stream.object).toEqual({
                type: "credentials",
                content: "har",
                secure: true,
            });
            expect(stream.object.objectType).toBeUndefined();
        });

        test("respects specialObj properties", () => {
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

        test("rejects nondefined special types", () => {
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
        test("emits an event on object creation", () => {
            function onHandler(obj) {
                expect(obj).toEqual({ id: "thingy3" });
                activity.off("activity-object-create", onHandler);
            }
            activity.on("activity-object-create", onHandler);
            activity.Object.create({ id: "thingy3" });
        });

        test("emits an event on object deletion", () => {
            activity.once("activity-object-delete", (id) => {
                expect(id).toEqual("thingy2");
            });
            activity.Object.delete("thingy2");
        });
    });
});
