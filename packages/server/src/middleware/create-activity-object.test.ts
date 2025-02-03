import { describe, it, expect } from "bun:test";
import createActivityObject from "./create-activity-object.js";

describe("Middleware: createActivityObject", () => {
    it("Calls activity.Object.create and fails with invalid property", (done) => {
        expect(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            createActivityObject({ foo: "bar" }, () => {
                done();
            });
        }).toThrow("invalid property: \"foo\"");
    });
    it("Calls activity.Object.create with incoming data", (done) => {
        createActivityObject({ context: "foo", type: "bar", actor: {type: "person", id: "some actor"} }, () => {
            done();
        });
    });
});
