import { expect, describe, it, beforeEach } from "bun:test";
import asObjects from "./validate.test.data.js";
import validate from "./validate.js";
import { ActivityStream } from "@sockethub/schemas";
import getInitObject from "../bootstrap/init.js";
import { initMockFakePlatform } from "../bootstrap/init.test.js";


describe("Middleware: Validate", async () => {
    const loadInitMock = await initMockFakePlatform("fakeplatform");
    const initObj = await getInitObject(loadInitMock);

    describe("AS object validations", () => {
        asObjects.forEach((obj) => {
            it(`${obj.type}: ${obj.name}, should ${
                obj.valid ? "pass" : "fail"
            }`, (done) => {
                validate(
                    obj.type,
                    "tests",
                    initObj,
                )(obj.input as ActivityStream, (msg) => {
                    if (obj.output) {
                        if (obj.output === "same") {
                            expect(msg).toEqual(obj.input);
                        } else {
                            expect(msg).toEqual(obj.output);
                        }
                    }
                    if (obj.valid) {
                        expect(msg).not.toBeInstanceOf(Error);
                    } else {
                        expect(msg).toBeInstanceOf(Error);
                        if (obj.error) {
                            expect(msg.toString()).toEqual(obj.error);
                        }
                    }
                    done();
                });
            });
        });
    });
});
