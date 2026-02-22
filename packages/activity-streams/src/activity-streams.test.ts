import { beforeEach, describe, expect, test } from "bun:test";
import type { ActivityStream } from "@sockethub/schemas";
import { ASFactory } from "./activity-streams";

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
            dude: ["foo", "secure"],
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
            // @ts-ignore
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
                // @ts-ignore
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
        let stream: ActivityStream;

        beforeEach(() => {
            stream = activity.Stream({
                type: "lol",
                actor: "thingy1",
                context: "irc",
                object: {
                    type: "credentials",
                    content: "har",
                    secure: true,
                },
                target: ["thingy1", "thingy2"],
            }) as ActivityStream;
        });

        test("keeps canonical stream props", () => {
            expect(stream.type).toEqual("lol");
            expect(stream.context).toEqual("irc");
        });

        test("expands existing objects", () => {
            // @ts-ignore
            expect(stream.target).toEqual([
                { id: "thingy1" },
                { id: "thingy2" },
            ]);
            // @ts-ignore
            expect(stream.actor).toEqual({ id: "thingy1" });
        });

        test("handles customProps as expected", () => {
            expect(stream.object).toEqual({
                type: "credentials",
                content: "har",
                secure: true,
            });
        });

        test("respects specialObj properties", () => {
            const stream2 = activity.Stream({
                type: "lol",
                context: "irc",
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
                    context: "irc",
                    actor: "thingy",
                    object: {
                        type: "hola",
                        foo: "bar",
                        content: "har",
                        secure: true,
                    },
                    target: ["thingy1", "thingy2"],
                });
            }).toThrow('ActivityStreams validation failed: property "foo" with value "bar" is not allowed on the "object" object of type "hola".');
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

describe("Object.create error handling tests", () => {
    const activity = ASFactory();

    test("throws clear error when passed null", () => {
        expect(() => {
            // @ts-ignore - intentionally testing invalid input
            activity.Object.create(null);
        }).toThrow('ActivityStreams validation failed: the "object" property is null. Example: { id: "user@example.com", type: "person" }');
    });

    test("throws clear error when passed undefined", () => {
        expect(() => {
            // @ts-ignore - intentionally testing invalid input
            activity.Object.create(undefined);
        }).toThrow('ActivityStreams validation failed: the "object" property is undefined. Example: { id: "user@example.com", type: "person" }');
    });

    test("throws clear error when passed string", () => {
        expect(() => {
            // @ts-ignore - intentionally testing invalid input
            activity.Object.create("string value");
        }).toThrow('ActivityStreams validation failed: the "object" property received string "string value" but expected an object. Use: { id: "string value", type: "person" }');
    });

    test("throws clear error when passed number", () => {
        expect(() => {
            // @ts-ignore - intentionally testing invalid input
            activity.Object.create(123);
        }).toThrow('ActivityStreams validation failed: the "object" property must be an object, received number (123). Example: { id: "user@example.com", type: "person" }');
    });

    test("throws clear error when passed boolean false", () => {
        expect(() => {
            // @ts-ignore - intentionally testing invalid input
            activity.Object.create(false);
        }).toThrow('ActivityStreams validation failed: the "object" property must be an object, received boolean (false). Example: { id: "user@example.com", type: "person" }');
    });

    test("throws clear error when passed boolean true", () => {
        expect(() => {
            // @ts-ignore - intentionally testing invalid input
            activity.Object.create(true);
        }).toThrow('ActivityStreams validation failed: the "object" property must be an object, received boolean (true). Example: { id: "user@example.com", type: "person" }');
    });

    test("throws clear error when passed array", () => {
        expect(() => {
            // @ts-ignore - intentionally testing invalid input
            activity.Object.create([]);
        }).toThrow('ActivityStreams validation failed: the "object" property must be an object, received array (). Example: { id: "user@example.com", type: "person" }');
    });

    test("throws clear error when passed empty object (missing required id)", () => {
        expect(() => {
            activity.Object.create({});
        }).toThrow('ActivityStreams validation failed: the "object" property requires an \'id\' property. Example: { id: "user@example.com", type: "person" }');
    });

    test("throws clear error when object has properties but missing id", () => {
        expect(() => {
            activity.Object.create({ type: "person", name: "John" });
        }).toThrow('ActivityStreams validation failed: the "object" property requires an \'id\' property. Example: { id: "user@example.com", type: "person" }');
    });

    test("handles object with only id property", () => {
        expect(() => {
            activity.Object.create({ id: "test-id" });
        }).not.toThrow();
    });
});
