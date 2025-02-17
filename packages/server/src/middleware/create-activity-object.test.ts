import { describe, expect, it } from "bun:test";
import createActivityObject from "./create-activity-object.js";

describe("Middleware: createActivityObject", () => {
    it("Calls activity.Object.create and fails with invalid property", async () => {
        expect(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            createActivityObject({ foo: "bar" }, (o) => {
                expect(o).not.toEqual({ foo: "bar" });
            });
        }).toThrow('invalid property: "foo"');
    });
    it("Calls activity.Object.create with incoming data", async () => {
        createActivityObject(
            {
                context: "foo",
                type: "bar",
                content: "some text",
            },
            (o) => {
                expect(o).toEqual({
                    context: "foo",
                    type: "bar",
                    content: "some text",
                });
            },
        );
    });
});
