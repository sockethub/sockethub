import { beforeEach, describe, expect, it } from "bun:test";

import {
    type ActivityStream,
    type CredentialsObject,
    addPlatformContext,
    addPlatformSchema,
    buildCanonicalContext,
    getPlatformSchema,
    validateCredentials,
    validatePlatformSchema,
} from "@sockethub/schemas";
import type { GetClientCallback } from "./index";

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
    id: "irc.example.com/#a-room",
    name: "#a-room",
};

const IRC_CONTEXT = buildCanonicalContext(
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
);

const validCredentials = {
    "@context": IRC_CONTEXT,
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
            log: {
                error: () => {},
                warn: () => {},
                info: () => {},
                debug: () => {},
            },
            updateActor: function async() {
                return Promise.resolve();
            },
            sendToClient: () => {},
        });
        platform.ircConnect = (
            credentials: CredentialsObject,
            cb: GetClientCallback,
        ) => {
            cb(null, {
                end: () => {},
                on: () => {},
                raw: () => {},
            });
        };
        if (!getPlatformSchema("irc/credentials")) {
            addPlatformSchema(platform.schema.credentials, `irc/credentials`);
        }
        addPlatformContext("irc", platform.schema.contextUrl);
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
            "disconnect"
        ]);
    });

    it("returns a config object", () => {
        expect(platform.config).toEqual({
            connectTimeoutMs: 30000,
            persist: true,
            requireCredentials: ["connect", "update"],
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
            const result = validateCredentials({
                "@context": IRC_CONTEXT,
                type: "credentials",
                actor,
                // @ts-expect-error test invalid params
                object: {
                    host: "example.com",
                    port: "6667",
                },
            });
            expect([
                "[irc] /object: must have required property 'type'",
                "[irc] /object/port: must be number",
                "[irc] /object: must match exactly one schema in oneOf: credentials, feed, message, me, person, room, service, platform, website, attendance, room-info, presence, relationship, topic, address, heartbeat",
            ]).toContain(result);
        });

        it("invalid credentials port", () => {
            expect(
                // @ts-expect-error test invalid params
                validateCredentials({
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
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
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
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

        it("valid credentials with OAUTHBEARER token", () => {
            expect(
                validateCredentials({
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
                    object: {
                        type: "credentials",
                        nick: "testingham",
                        server: "irc.example.com",
                        saslMechanism: "OAUTHBEARER",
                        token: "oauth-access-token",
                    },
                }),
            ).toEqual("");
        });

        it("valid credentials with PLAIN mechanism and password", () => {
            expect(
                validateCredentials({
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
                    object: {
                        type: "credentials",
                        nick: "testingham",
                        server: "irc.example.com",
                        saslMechanism: "PLAIN",
                        password: "secret",
                    },
                }),
            ).toEqual("");
        });

        it("valid credentials with token only (PLAIN, e.g. Libera PAT)", () => {
            expect(
                validateCredentials({
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
                    object: {
                        type: "credentials",
                        nick: "testingham",
                        server: "irc.libera.chat",
                        token: "my-personal-access-token",
                    },
                }),
            ).toEqual("");
        });

        it("valid credentials with token and explicit PLAIN mechanism", () => {
            expect(
                validateCredentials({
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
                    object: {
                        type: "credentials",
                        nick: "testingham",
                        server: "irc.libera.chat",
                        saslMechanism: "PLAIN",
                        token: "my-personal-access-token",
                    },
                }),
            ).toEqual("");
        });

        it("rejects unknown saslMechanism", () => {
            expect(
                validateCredentials({
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
                    object: {
                        type: "credentials",
                        nick: "testingham",
                        server: "irc.example.com",
                        // @ts-expect-error test invalid params
                        saslMechanism: "SCRAM-SHA-256",
                    },
                }),
            ).toContain(
                "/object/saslMechanism: must be equal to one of the allowed values",
            );
        });

        it("rejects both password and token set", () => {
            expect(
                validateCredentials({
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
                    object: {
                        type: "credentials",
                        nick: "testingham",
                        server: "irc.example.com",
                        password: "secret",
                        token: "oauth-access-token",
                    },
                }),
            ).toContain("/object: must NOT be valid");
        });

        it("rejects OAUTHBEARER with password instead of token", () => {
            const result = validateCredentials({
                "@context": IRC_CONTEXT,
                type: "credentials",
                actor,
                object: {
                    type: "credentials",
                    nick: "testingham",
                    server: "irc.example.com",
                    saslMechanism: "OAUTHBEARER",
                    password: "secret",
                },
            });
            expect(result).not.toEqual("");
        });

        it("rejects OAUTHBEARER without any credential", () => {
            const result = validateCredentials({
                "@context": IRC_CONTEXT,
                type: "credentials",
                actor,
                object: {
                    type: "credentials",
                    nick: "testingham",
                    server: "irc.example.com",
                    // @ts-expect-error test incomplete credentials
                    saslMechanism: "OAUTHBEARER",
                },
            });
            expect(result).not.toEqual("");
        });

        it("rejects PLAIN without any credential", () => {
            const result = validateCredentials({
                "@context": IRC_CONTEXT,
                type: "credentials",
                actor,
                object: {
                    type: "credentials",
                    nick: "testingham",
                    server: "irc.example.com",
                    // @ts-expect-error test incomplete credentials
                    saslMechanism: "PLAIN",
                },
            });
            expect(result).not.toEqual("");
        });

        it("rejects empty token", () => {
            expect(
                validateCredentials({
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
                    object: {
                        type: "credentials",
                        nick: "testingham",
                        server: "irc.example.com",
                        // @ts-expect-error test empty string
                        token: "",
                    },
                }),
            ).toContain("must NOT have fewer than 1 characters");
        });

        it("rejects empty password", () => {
            expect(
                validateCredentials({
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
                    object: {
                        type: "credentials",
                        nick: "testingham",
                        server: "irc.example.com",
                        // @ts-expect-error test empty string
                        password: "",
                    },
                }),
            ).toContain("must NOT have fewer than 1 characters");
        });
    });

    describe("platform type methods", () => {
        beforeEach((done) => {
            platform.connect(
                {
                    "@context": IRC_CONTEXT,
                    type: "connect",
                    actor: actor,
                },
                { object: { server: "a server address" } },
                done,
            );
        });

        it("rejects a join with a bare (unqualified) channel target", (done) => {
            platform.join(
                {
                    "@context": IRC_CONTEXT,
                    type: "join",
                    actor: actor,
                    target: {
                        type: "room",
                        id: "#bare-room",
                        name: "#bare-room",
                    },
                },
                (err) => {
                    expect(err).toContain("server-qualified");
                    done();
                },
            );
        });

        describe("after join", () => {
            beforeEach((done) => {
                platform.join(
                    {
                        "@context": IRC_CONTEXT,
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
                        "@context": IRC_CONTEXT,
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
                        "@context": IRC_CONTEXT,
                        type: "send",
                        actor: actor,
                        object: { content: "har dee dar" },
                        target: targetRoom,
                    } as ActivityStream,
                    done,
                );
                platform.completeJob();
            });

            // Regression coverage for the /me handling: /me must report
            // synchronous success without enqueueing a jobQueue handler.
            // See the long comment in src/index.ts for the protocol-level
            // reasoning (no echo-message capability => no incoming event
            // for the sender's PRIVMSG/CTCP ACTION).
            it("send() /me completes synchronously without queueing", async () => {
                expect(platform.jobQueue.length).toEqual(0);
                const meErr = await new Promise((resolve) => {
                    platform.send(
                        {
                            "@context": IRC_CONTEXT,
                            type: "send",
                            actor: actor,
                            object: { content: "/me waves" },
                            target: targetRoom,
                        } as ActivityStream,
                        (err: unknown) => resolve(err),
                    );
                });
                expect(meErr).toBeUndefined();
                expect(platform.jobQueue.length).toEqual(0);
            });

            it("send() /me does not consume an in-flight job's handler", async () => {
                // Queue a normal send first; do NOT complete it.
                let normalDoneCalls = 0;
                platform.send(
                    {
                        "@context": IRC_CONTEXT,
                        type: "send",
                        actor: actor,
                        object: { content: "first message" },
                        target: targetRoom,
                    } as ActivityStream,
                    () => {
                        normalDoneCalls++;
                    },
                );
                // Wait a tick for the async send path to push onto jobQueue.
                await new Promise((r) => setImmediate(r));
                expect(platform.jobQueue.length).toEqual(1);

                // Now issue a /me. Its done callback should fire without
                // touching the queued handler of the prior send.
                const meErr = await new Promise((resolve) => {
                    platform.send(
                        {
                            "@context": IRC_CONTEXT,
                            type: "send",
                            actor: actor,
                            object: { content: "/me sneaks in" },
                            target: targetRoom,
                        } as ActivityStream,
                        (err: unknown) => resolve(err),
                    );
                });
                expect(meErr).toBeUndefined();
                expect(normalDoneCalls).toEqual(0);
                expect(platform.jobQueue.length).toEqual(1);

                // Drain the normal send's handler explicitly.
                platform.completeJob();
                expect(normalDoneCalls).toEqual(1);
                expect(platform.jobQueue.length).toEqual(0);
            });

            it("update() topic", (done) => {
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
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
                        "@context": IRC_CONTEXT,
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

            describe("query() attendance", () => {
                let rawCalls;
                beforeEach(() => {
                    rawCalls = [];
                    platform.client.raw = (...args) => {
                        rawCalls.push(args);
                    };
                });

                it("sends NAMES for the target channel name", (done) => {
                    platform.query(
                        {
                            "@context": IRC_CONTEXT,
                            type: "query",
                            actor: actor,
                            target: targetRoom,
                            object: { type: "attendance" },
                        },
                        (err) => {
                            expect(err).toBeUndefined();
                            expect(rawCalls).toEqual([[["NAMES", "#a-room"]]]);
                            done();
                        },
                    );
                });

                it("derives the channel from target.id when name is missing", (done) => {
                    platform.query(
                        {
                            "@context": IRC_CONTEXT,
                            type: "query",
                            actor: actor,
                            target: {
                                type: "room",
                                id: "irc.example.com/#a-room",
                            },
                            object: { type: "attendance" },
                        },
                        (err) => {
                            expect(err).toBeUndefined();
                            expect(rawCalls).toEqual([[["NAMES", "#a-room"]]]);
                            done();
                        },
                    );
                });

                // Regression coverage for sockethub/sockethub#1085: a query
                // with no resolvable channel must error rather than emit a
                // bare `NAMES`, which the server answers with the entire
                // network channel list (presence flood for unjoined rooms).
                it("rejects without sending a bare NAMES when no channel resolves", (done) => {
                    platform.query(
                        {
                            "@context": IRC_CONTEXT,
                            type: "query",
                            actor: actor,
                            target: { type: "room", id: "irc.example.com/" },
                            object: { type: "attendance" },
                        },
                        (err) => {
                            expect(err).toEqual(
                                "IRC room targets must be server-qualified as 'server/#channel'",
                            );
                            expect(rawCalls).toEqual([]);
                            done();
                        },
                    );
                });
            });

            it("disconnect()", (done) => {
                expect(platform.isInitialized()).toEqual(true);
                let cleanupCalled = false;
                platform.cleanup = (cb) => {
                    cleanupCalled = true;
                    cb();
                }
                platform.disconnect({
                        "@context": IRC_CONTEXT,
                        type: "disconnect",
                        actor: actor,
                    },
                    () => {
                    expect(platform.isInitialized()).toEqual(true);
                    expect(cleanupCalled).toEqual(true);
                    done();
                });
            });

            it("cleanup()", (done) => {
                expect(platform.isInitialized()).toEqual(true);
                platform.cleanup(() => {
                    expect(platform.isInitialized()).toEqual(false);
                    done();
                });
            });
        });
    });
});
