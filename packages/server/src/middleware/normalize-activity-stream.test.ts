import { describe, expect, it } from "bun:test";

import normalizeActivityStreamMiddleware from "./normalize-activity-stream.js";

import asObjects from "./normalize-activity-stream.test.data.js";
import type { ActivityStream } from "@sockethub/schemas";

describe("Middleware: Normalize Activity Stream", () => {
    describe("AS object normalization", () => {
        asObjects.forEach((obj) => {
            it(`${obj.type}: ${obj.name}, should ${
                obj.valid ? "pass" : "fail"
            }`, (done) => {
                normalizeActivityStreamMiddleware(
                    obj.input as ActivityStream,
                    (msg) => {
                        if (obj.output) {
                            if (obj.output === "same") {
                                expect(obj.input).toEqual(msg);
                            } else {
                                expect(obj.output).toEqual(msg);
                            }
                        }
                        if (obj.valid) {
                            expect(msg instanceof Error).toBeFalse();
                        } else {
                            expect(msg instanceof Error).toBeTrue();
                            if (obj.error) {
                                expect(obj.error).toEqual(msg.toString());
                            }
                        }
                        done();
                    },
                );
            });
        });
    });
});
