import {expect, describe, it, beforeEach} from "bun:test";

import {
    ActivityStream,
    CredentialsObject,
    addPlatformSchema,
    getPlatformSchema,
    validatePlatformSchema,
    validateCredentials,
} from "@sockethub/schemas";
import { GetClientCallback } from "./index";

import IRC from "./index";

const actor = {
    type: "person",
    id: "testingham@irc.example.com",
    name: "testingham",
};

const newActor = {
    type: "person",
    id: "testler@irc.example.com",
    name: "testler",
};

const targetRoom = {
    type: "room",
    id: "irc.example.com/a-room",
    name: "#a-room",
};

const validCredentials = {
    context: "irc",
    type: "credentials",
    actor: actor,
    object: {
        type: "credentials",
        nick: "testingham",
        server: "irc.example.com",
    },
};

describe("Initialize IRC Platform", () => {
    let platform;
    beforeEach(() => {
        platform = new IRC({
            debug: function () {},
            updateActor: function async() {
                return Promise.resolve();
            },
            sendToClient: function () {},
        });
        platform.ircConnect = function (
            key: string,
            credentials: CredentialsObject,
            cb: GetClientCallback,
        ) {
            cb(null, {
                end: () => {},
                on: function () {},
                raw: () => {},
            });
        };
        if (!getPlatformSchema("irc/credentials")) {
            addPlatformSchema(platform.schema.credentials, `irc/credentials`);
        }
    });

    it("lists required types enum", () => {
        expect(platform.schema.messages.properties.type.enum).toEqual([
            "connect",
            "update",
            "join",
            "leave",
            "send",
            "query",
            "announce",
        ]);
    });

    it("returns a config object", () => {
        expect(platform.config).toEqual({
            persist: true,
            requireCredentials: ["connect", "update"],
            initialized: false,
        });
    });

    it("schema format validation", () => {
        expect(validatePlatformSchema(platform.schema)).toEqual("");
    });

    describe("credential schema", () => {
        it("valid credentials", () => {
            expect(validateCredentials(validCredentials)).toEqual("");
        });

        it("invalid credentials type", () => {
            expect(
                validateCredentials({
                    context: "irc",
                    type: "credentials",
                    // @ts-expect-error test invalid params
                    object: {
                        host: "example.com",
                        port: "6667",
                    },
                }),
            ).toEqual("[irc] /object: must have required property 'type'");
        });

        it("invalid credentials port", () => {
            expect(
                // @ts-expect-error test invalid params
                validateCredentials({
                    context: "irc",
                    type: "credentials",
                    object: {
                        type: "credentials",
                        host: "example.com",
                        port: "6667",
                    },
                }),
            ).toEqual("[irc] /object/port: must be number");
        });

        it("invalid credentials additional prop", () => {
            expect(
                // @ts-expect-error test invalid params
                validateCredentials({
                    context: "irc",
                    type: "credentials",
                    object: {
                        type: "credentials",
                        host: "example.com",
                        port: 6667,
                    },
                }),
            ).toEqual(
                "[irc] /object: must NOT have additional properties: host",
            );
        });
    });

    describe("platform type methods", () => {
        beforeEach((done) => {
            platform.connect(
                {
                    context: "irc",
                    type: "connect",
                    actor: actor,
                },
                { object: { server: "a server address" } },
                done,
            );
        });

        describe("after join", () => {
            beforeEach((done) => {
                platform.join(
                    {
                        context: "irc",
                        type: "join",
                        actor: actor,
                        target: targetRoom,
                    },
                    done,
                );
                platform.completeJob();
            });

            it("has join channel registered", () => {
                expect(platform.channels.has("#a-room")).toEqual(true);
            });

            it("leave()", (done) => {
                platform.leave(
                    {
                        context: "irc",
                        type: "leave",
                        actor: actor,
                        target: targetRoom,
                    },
                    done,
                );
                platform.completeJob();
            });

            it("send()", (done) => {
                platform.send(
                    {
                        context: "irc",
                        type: "send",
                        actor: actor,
                        object: { content: "har dee dar" },
                        target: targetRoom,
                    } as ActivityStream,
                    done,
                );
                platform.completeJob();
            });

            it("update() topic", (done) => {
                platform.update(
                    {
                        context: "irc",
                        type: "update",
                        actor: actor,
                        object: { type: "topic", content: "important details" },
                        target: targetRoom,
                    },
                    validCredentials,
                    done,
                );
                platform.completeJob();
            });

            it("update() nick change", (done) => {
                platform.update(
                    {
                        context: "irc",
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    validCredentials,
                    done,
                );
                platform.completeJob();
            });

            it("query()", (done) => {
                platform.query(
                    {
                        context: "irc",
                        type: "query",
                        actor: actor,
                        target: targetRoom,
                        object: { type: "attendance" },
                    },
                    done,
                );
                platform.completeJob();
            });

            it("cleanup()", (done) => {
                expect(platform.config.initialized).toEqual(true);
                platform.cleanup(() => {
                    expect(platform.config.initialized).toEqual(false);
                    done();
                });
            });
        });
    });
});
