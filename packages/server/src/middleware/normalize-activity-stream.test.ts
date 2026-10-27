import { describe, expect, test } from "bun:test";

import normalizeActivityStreamMiddleware, {
    exceedsDepth,
    MAX_MESSAGE_DEPTH,
} from "./normalize-activity-stream.js";
import { attachError } from "../message-handlers.js";

import asObjects from "./normalize-activity-stream.test.data.js";
import type { ActivityStream } from "@sockethub/schemas";

describe("Middleware: Normalize Activity Stream", () => {
    describe("AS object normalization", () => {
        asObjects.forEach((obj) => {
            test(`${obj.type}: ${obj.name}, should ${
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

    describe("nesting depth", () => {
        function nest(levels: number): Record<string, unknown> {
            let object: Record<string, unknown> = { type: "x" };
            for (let i = 0; i < levels; i++) {
                object = { type: "x", o: object };
            }
            return object;
        }

        function stream(object: unknown) {
            return {
                "@context": [
                    "https://www.w3.org/ns/activitystreams",
                    "https://sockethub.org/ns/context/v1.jsonld",
                    "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
                ],
                type: "send",
                actor: { id: "a@irc.example", type: "person" },
                object,
            } as unknown as ActivityStream;
        }

        test("exceedsDepth handles objects and arrays without recursing", () => {
            expect(exceedsDepth(nest(MAX_MESSAGE_DEPTH - 2))).toBeFalse();
            expect(exceedsDepth(nest(MAX_MESSAGE_DEPTH + 1))).toBeTrue();
            expect(exceedsDepth(nest(200000))).toBeTrue();
            let arr: unknown[] = [];
            for (let i = 0; i < 200000; i++) {
                arr = [arr];
            }
            expect(exceedsDepth(arr)).toBeTrue();
            expect(exceedsDepth("string")).toBeFalse();
        });

        test("rejects over-deep messages", (done) => {
            normalizeActivityStreamMiddleware(stream(nest(200000)), (msg) => {
                expect(msg instanceof Error).toBeTrue();
                expect((msg as Error).message).toEqual(
                    "activity stream nesting too deep.",
                );
                done();
            });
        });

        test("accepts messages within the limit", (done) => {
            normalizeActivityStreamMiddleware(stream(nest(10)), (msg) => {
                expect(msg instanceof Error).toBeFalse();
                done();
            });
        });

        test("attachError does not echo over-deep payloads", () => {
            const msg = stream(nest(200000));
            expect(attachError("boom", msg)).toEqual({
                "@context": msg["@context"],
                type: "send",
                error: "boom",
            } as unknown as ActivityStream);
        });

        test("attachError still echoes normal payloads", () => {
            const msg = stream(nest(2));
            expect(attachError("boom", msg)).toEqual({
                ...msg,
                error: "boom",
            });
        });
    });
});
