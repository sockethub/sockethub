import { describe, expect, it } from "bun:test";
import createActivityObject from "./create-activity-object.js";

describe("Middleware: createActivityObject", () => {
    it("Calls activity.Object.create and fails with invalid property", async () => {
        expect(() => {
            createActivityObject({ foo: "bar" }, (o) => {
                expect(o).not.toEqual({ foo: "bar" });
            });
        }).toThrow("ActivityStreams validation failed: the \"object\" property requires an 'id' property. Example: { id: \"user@example.com\", type: \"person\" }");
    });
    it("Calls activity.Object.create with incoming data", async () => {
        createActivityObject(
            {
                id: "test",
                type: "bar",
                content: "some text",
            },
            (o) => {
                expect(o).toEqual({
                    id: "test",
                    type: "bar",
                    content: "some text",
                });
            },
        );
    });
});
