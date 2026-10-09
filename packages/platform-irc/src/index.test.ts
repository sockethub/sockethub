import { beforeEach, describe, expect, it, mock } from "bun:test";

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

let capturedIrcSocketOptions:
    | {
          connectOptions?: { rejectUnauthorized: boolean };
          nicknames?: string[];
          username?: string;
      }
    | undefined;

mock.module("irc-socket-sasl", () => ({
    default: class FakeIrcSocket {
        constructor(options: {
            connectOptions?: { rejectUnauthorized: boolean };
            nicknames?: string[];
            username?: string;
        }) {
            capturedIrcSocketOptions = options;
        }

        connect() {
            return Promise.resolve({
                isFail: () => false,
                fail: () => "",
                ok: () => true,
                end: () => {},
            });
        }

        once() {}

        end() {}

        raw() {}

        on() {}
    },
}));

const { default: IRC, flattenConnectOptions } = await import("./index");

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
    id: "#a-room@irc.example.com",
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
        // Nick-change handlers write the new identity onto the credentials
        // actor. That object is shared with `actor` / `validCredentials`, so
        // put the originals back before each test.
        actor.id = "testingham@irc.example.com";
        actor.name = "testingham";
        validCredentials.object.nick = "testingham";
        validCredentials.object.server = "irc.example.com";
        validCredentials.actor = actor;
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
            const client = {
                end: () => {},
                on: () => {},
                raw: () => {},
            };
            platform.client = client;
            platform.credentials = credentials;
            platform.handledActors.add(credentials.actor.id);
            platform.registerListeners(credentials.object.server);
            cb(null, client);
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

        it("valid credentials with allowInvalidCert", () => {
            expect(
                validateCredentials({
                    "@context": IRC_CONTEXT,
                    type: "credentials",
                    actor,
                    object: {
                        type: "credentials",
                        nick: "testingham",
                        server: "irc.example.com",
                        allowInvalidCert: true,
                    },
                }),
            ).toEqual("");
        });

        it("rejects non-boolean allowInvalidCert", () => {
            const result = validateCredentials({
                "@context": IRC_CONTEXT,
                type: "credentials",
                actor,
                object: {
                    type: "credentials",
                    nick: "testingham",
                    server: "irc.example.com",
                    // @ts-expect-error test invalid params
                    allowInvalidCert: "yes",
                },
            });
            expect(result).toContain("/object/allowInvalidCert");
            expect(result).toContain("must be boolean");
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
                structuredClone(validCredentials),
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

        it("preserves multiple channel sigils when resolving a room target", () => {
            expect(
                platform.resolveIrcTarget({
                    type: "room",
                    id: "##a-room@irc.example.com",
                }),
            ).toEqual("##a-room");
        });

        it("fails a join when the server replies that the channel is unavailable", async () => {
            let failure: unknown;
            platform.join(
                {
                    "@context": IRC_CONTEXT,
                    type: "join",
                    actor: actor,
                    target: targetRoom,
                },
                (err: unknown) => {
                    failure = err;
                },
            );
            await new Promise((resolve) => setImmediate(resolve));

            expect(() => {
                platform.irc2as.input(
                    ":irc.example.com 473 testingham #a-room :Cannot join channel (+i)",
                );
            }).not.toThrow();
            await new Promise((resolve) => setImmediate(resolve));

            expect(failure).toEqual("Cannot join channel (+i)");
            expect(platform.jobQueue.length).toEqual(0);
            expect(platform.channels.has("#a-room")).toEqual(false);
        });

        it("does not let the PONG from a failed join complete the next join", () => {
            let first: unknown = "pending";
            platform.join(
                {
                    "@context": IRC_CONTEXT,
                    type: "join",
                    actor: actor,
                    target: targetRoom,
                },
                (err: unknown) => {
                    first = err;
                },
            );
            platform.irc2as.input(
                ":irc.example.com 473 testingham #a-room :Cannot join channel (+i)",
            );
            expect(first).toEqual("Cannot join channel (+i)");

            const otherRoom = {
                type: "room",
                id: "#other-room@irc.example.com",
                name: "#other-room",
            };
            let second: unknown = "pending";
            platform.join(
                {
                    "@context": IRC_CONTEXT,
                    type: "join",
                    actor: actor,
                    target: otherRoom,
                },
                (err: unknown) => {
                    second = err ?? null;
                },
            );

            // This PONG answers the PING sent with the failed join. The next
            // join is already queued, which is what happens when the client
            // pipelines a second command and Redis starts it before the
            // remote PONG arrives.
            platform.irc2as.input(
                ":irc.example.com PONG irc.example.com :testingham",
            );
            expect(second).toEqual("pending");
            expect(platform.channels.has("#other-room")).toEqual(false);
            expect(platform.jobQueue.length).toEqual(1);

            platform.irc2as.input(
                ":irc.example.com PONG irc.example.com :testingham",
            );
            expect(second).toEqual(null);
            expect(platform.channels.has("#other-room")).toEqual(true);
            expect(platform.jobQueue.length).toEqual(0);
        });

        it("does not skip a join acknowledgement when a numeric error had no command in flight", () => {
            platform.irc2as.input(
                ":irc.example.com 473 testingham #secret :Cannot join channel (+i)",
            );

            let result: unknown = "pending";
            platform.join(
                {
                    "@context": IRC_CONTEXT,
                    type: "join",
                    actor: actor,
                    target: targetRoom,
                },
                (err: unknown) => {
                    result = err ?? null;
                },
            );
            platform.irc2as.input(
                ":irc.example.com PONG irc.example.com :testingham",
            );

            expect(result).toEqual(null);
            expect(platform.channels.has("#a-room")).toEqual(true);
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

            it("rejects IRC line injection before writing to the socket", async () => {
                const rawCalls: Array<unknown> = [];
                platform.client.raw = (...args) => rawCalls.push(args);

                const err = await new Promise((resolve) => {
                    platform.send(
                        {
                            "@context": IRC_CONTEXT,
                            type: "send",
                            actor,
                            object: { content: "hello\nJOIN #other" },
                            target: targetRoom,
                        } as ActivityStream,
                        resolve,
                    );
                });

                expect(err).toContain("must not contain CR or LF");
                expect(rawCalls).toHaveLength(0);
            });

            it("rejects IRC line injection in a person target id", async () => {
                const rawCalls: Array<unknown> = [];
                platform.client.raw = (...args) => rawCalls.push(args);

                const err = await new Promise((resolve) => {
                    platform.send(
                        {
                            "@context": IRC_CONTEXT,
                            type: "send",
                            actor,
                            object: { content: "hello" },
                            target: {
                                type: "person",
                                id: "victim\r\nNAMES\r\nPRIVMSG #unjoined",
                                name: "safe",
                            },
                        } as ActivityStream,
                        resolve,
                    );
                });

                expect(err).toContain("must not contain CR or LF");
                expect(rawCalls).toHaveLength(0);
            });

            // Regression coverage for the /me handling: /me must report
            // synchronous success without enqueueing a jobQueue handler.
            // See the long comment in src/index.ts for the protocol-level
            // reasoning (no echo-message capability => no incoming event
            // for the sender's PRIVMSG/CTCP ACTION).
            it("send() /me completes synchronously without queueing", async () => {
                const rawCalls: Array<unknown> = [];
                platform.client.raw = (...args) => rawCalls.push(args);
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
                // CTCP ACTION framing: payload delimited by 0x01 bytes
                expect(rawCalls).toEqual([
                    [
                        `PRIVMSG ${targetRoom.name} :${String.fromCharCode(1)}ACTION waves${String.fromCharCode(1)}`,
                    ],
                ]);
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

            it("update() nick change reports an actor-update failure", (done) => {
                platform.updateActor = () =>
                    Promise.reject(new Error("redis down"));
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    validCredentials,
                    (err: unknown) => {
                        expect(err).toEqual("redis down");
                        done();
                    },
                );
                platform.completeJob();
            });

            it("keeps the stored identity when actor update fails after the server accepts", async () => {
                const rawCalls: Array<unknown> = [];
                platform.client.raw = (...args: Array<unknown>) => {
                    rawCalls.push(args);
                };
                platform.updateActor = () =>
                    Promise.reject(new Error("redis down"));
                const creds = structuredClone(validCredentials);
                let failure: unknown;
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    creds,
                    (err: unknown) => {
                        failure = err;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));
                platform.completeJob();
                await new Promise((resolve) => setImmediate(resolve));

                expect(failure).toEqual("redis down");
                // No second NICK: the store was not touched, so the client
                // keeps routing by the old actor, and the socket keeps the
                // nick the server gave it.
                expect(rawCalls).toEqual([
                    [["NICK", "testler"]],
                    ["PING testingham"],
                ]);
                expect(creds.object.nick).toEqual("testingham");
                expect(creds.actor.id).toEqual("testingham@irc.example.com");
                expect(creds.actor.name).toEqual("testingham");
                expect(
                    platform.handledActors.has("testingham@irc.example.com"),
                ).toEqual(false);
                expect(
                    platform.handledActors.has("testler@irc.example.com"),
                ).toEqual(true);
            });

            it("does not send NICK when the rename would overwrite another account", async () => {
                const rawCalls: Array<unknown> = [];
                platform.client.raw = (...args: Array<unknown>) => {
                    rawCalls.push(args);
                };
                platform.prepareActorUpdate = () =>
                    Promise.reject(
                        new Error(
                            "cannot rename testingham@irc.example.com to testler@irc.example.com: credentials already stored for testler@irc.example.com",
                        ),
                    );
                const creds = structuredClone(validCredentials);
                let failure: unknown;
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    creds,
                    (err: unknown) => {
                        failure = err;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));

                expect(failure).toEqual(
                    "cannot rename testingham@irc.example.com to testler@irc.example.com: credentials already stored for testler@irc.example.com",
                );
                expect(rawCalls).toEqual([]);
                expect(platform.jobQueue.length).toEqual(0);
                expect(creds.object.nick).toEqual("testingham");
                expect(creds.actor.id).toEqual(
                    "testingham@irc.example.com",
                );
            });

            it("delivers traffic for a nick this connection does not yet own", async () => {
                const delivered: Array<ActivityStream> = [];
                platform.sendToClient = (msg: ActivityStream) => {
                    delivered.push(msg);
                };
                const creds = structuredClone(validCredentials);
                let finished = false;
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    creds,
                    () => {
                        finished = true;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));

                expect(platform.handledActors.has(newActor.id)).toEqual(false);
                expect(platform.jobQueue.length).toEqual(1);

                const fromRequestedNick = {
                    "@context": IRC_CONTEXT,
                    type: "send",
                    actor: {
                        type: "person",
                        id: newActor.id,
                        name: newActor.name,
                    },
                    object: { type: "message", content: "still my nick" },
                } as ActivityStream;
                platform.irc2as.events.emit("incoming", fromRequestedNick);

                expect(finished).toEqual(false);
                expect(platform.jobQueue.length).toEqual(1);
                expect(delivered).toEqual([fromRequestedNick]);

                platform.completeJob();
                await new Promise((resolve) => setImmediate(resolve));

                expect(finished).toEqual(true);
                expect(platform.handledActors.has(actor.id)).toEqual(false);
                expect(platform.handledActors.has(newActor.id)).toEqual(true);

                const fromPreviousNick = {
                    "@context": IRC_CONTEXT,
                    type: "send",
                    actor: { type: "person", id: actor.id, name: actor.name },
                    object: { type: "message", content: "I took the old nick" },
                } as ActivityStream;
                platform.irc2as.events.emit("incoming", fromPreviousNick);
                expect(delivered).toEqual([
                    fromRequestedNick,
                    fromPreviousNick,
                ]);
            });

            it("keeps the current nick when the server rejects the change", async () => {
                const creds = structuredClone(validCredentials);
                let failure: unknown;
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    creds,
                    (err: unknown) => {
                        failure = err;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));

                platform.completeJob("Nickname is already in use");

                expect(failure).toEqual("Nickname is already in use");
                expect(platform.handledActors.has(actor.id)).toEqual(true);
                expect(platform.handledActors.has(newActor.id)).toEqual(false);
            });

            it("does not let the PONG from a successful nick change complete the next join", async () => {
                const creds = structuredClone(validCredentials);
                let nickResult: unknown = "pending";
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    creds,
                    (err: unknown) => {
                        nickResult = err ?? null;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));

                platform.irc2as.input(":testingham!u@h NICK testler");
                await new Promise((resolve) => setImmediate(resolve));

                expect(nickResult).toEqual(null);
                expect(platform.jobQueue.length).toEqual(0);

                const otherRoom = {
                    type: "room",
                    id: "#other-room@irc.example.com",
                    name: "#other-room",
                };
                let joinResult: unknown = "pending";
                platform.join(
                    {
                        "@context": IRC_CONTEXT,
                        type: "join",
                        actor: creds.actor,
                        target: otherRoom,
                    },
                    (err: unknown) => {
                        joinResult = err ?? null;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));

                // This PONG answers the PING sent with the nick change. The
                // next join is already queued, which is what happens when
                // Redis starts it before the remote PONG arrives.
                platform.irc2as.input(
                    ":irc.example.com PONG irc.example.com :testingham",
                );
                expect(joinResult).toEqual("pending");
                expect(platform.channels.has("#other-room")).toEqual(false);
                expect(platform.jobQueue.length).toEqual(1);

                platform.irc2as.input(
                    ":irc.example.com PONG irc.example.com :testingham",
                );
                expect(joinResult).toEqual(null);
                expect(platform.channels.has("#other-room")).toEqual(true);
                expect(platform.jobQueue.length).toEqual(0);
            });

            it("still acknowledges a join when the nick change PONG arrived first", async () => {
                const creds = structuredClone(validCredentials);
                let nickResult: unknown = "pending";
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    creds,
                    (err: unknown) => {
                        nickResult = err ?? null;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));

                platform.irc2as.input(":testingham!u@h NICK testler");
                platform.irc2as.input(
                    ":irc.example.com PONG irc.example.com :testingham",
                );
                await new Promise((resolve) => setImmediate(resolve));
                expect(nickResult).toEqual(null);

                const otherRoom = {
                    type: "room",
                    id: "#other-room@irc.example.com",
                    name: "#other-room",
                };
                let joinResult: unknown = "pending";
                platform.join(
                    {
                        "@context": IRC_CONTEXT,
                        type: "join",
                        actor: creds.actor,
                        target: otherRoom,
                    },
                    (err: unknown) => {
                        joinResult = err ?? null;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));
                platform.irc2as.input(
                    ":irc.example.com PONG irc.example.com :testingham",
                );

                expect(joinResult).toEqual(null);
                expect(platform.channels.has("#other-room")).toEqual(true);
                expect(platform.jobQueue.length).toEqual(0);
            });

            it("fails a nick change when the server replies that the nick is in use", async () => {
                const creds = structuredClone(validCredentials);
                let failure: unknown;
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    creds,
                    (err: unknown) => {
                        failure = err;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));

                // irc2as emits this on `error` with the text on `error`, not
                // `object.content`. Reading the wrong field used to throw out
                // of the socket listener (fatal to the platform process) and,
                // because a nick change only completes on nickAck, the PONG
                // for the trailing PING never unblocked the command.
                expect(() => {
                    platform.irc2as.input(
                        ":irc.example.com 433 testingham testler :Nickname is already in use.",
                    );
                }).not.toThrow();
                await new Promise((resolve) => setImmediate(resolve));

                expect(failure).toEqual("Nickname is already in use.");
                expect(platform.jobQueue.length).toEqual(0);
                expect(platform.handledActors.has(actor.id)).toEqual(true);
                expect(platform.handledActors.has(newActor.id)).toEqual(false);
                expect(creds.object.nick).toEqual("testingham");
                expect(creds.actor.id).toEqual(actor.id);
            });

            it("fails a nick change when the server says it is too fast", async () => {
                const creds = structuredClone(validCredentials);
                let failure: unknown;
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    creds,
                    (err: unknown) => {
                        failure = err;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));

                // solanum, ircu, and Unreal reject a nick change past the
                // flood limit with 438. That numeric used to be unprocessed,
                // and a nick change only completes on nickAck or an error, so
                // the PONG for the trailing PING never unblocked the command.
                // Every later join or send then waited behind it.
                platform.irc2as.input(
                    ":irc.example.com 438 testingham testler :Nick change too fast. Please wait 29 seconds.",
                );
                await new Promise((resolve) => setImmediate(resolve));

                expect(failure).toEqual(
                    "Nick change too fast. Please wait 29 seconds.",
                );
                expect(platform.jobQueue.length).toEqual(0);
                expect(platform.handledActors.has(actor.id)).toEqual(true);
                expect(platform.handledActors.has(newActor.id)).toEqual(false);
                expect(creds.object.nick).toEqual("testingham");
            });

            it("does not throw when a numeric error arrives with no command in flight", () => {
                platform.ircConnect(validCredentials, () => {});
                expect(() => {
                    platform.irc2as.input(
                        ":irc.example.com 473 testingham #a-room :Cannot join channel (+i)",
                    );
                }).not.toThrow();
                expect(platform.jobQueue.length).toEqual(0);
            });

            it("delivers a server-initiated nick change while idle", async () => {
                const delivered: Array<ActivityStream> = [];
                let actorUpdated = false;
                platform.sendToClient = (msg: ActivityStream) => {
                    delivered.push(msg);
                };
                platform.updateActor = async () => {
                    actorUpdated = true;
                };
                const forced = {
                    "@context": IRC_CONTEXT,
                    type: "update",
                    actor: { type: "person", id: actor.id, name: actor.name },
                    target: {
                        type: "person",
                        id: "Guest12345@irc.example.com",
                        name: "Guest12345",
                    },
                    object: { type: "address" },
                } as ActivityStream;

                platform.irc2as.events.emit("incoming", forced);
                await new Promise((resolve) => setImmediate(resolve));

                expect(platform.jobQueue.length).toEqual(0);
                expect(delivered).toEqual([forced]);
                expect(actorUpdated).toEqual(true);
                expect(platform.handledActors.has(actor.id)).toEqual(false);
                expect(platform.handledActors.has(forced.target.id)).toEqual(
                    true,
                );
                expect(platform.credentials.object.nick).toEqual("Guest12345");
                expect(platform.credentials.actor.id).toEqual(
                    "Guest12345@irc.example.com",
                );
            });

            it("reports a forced nick that cannot be stored instead of adopting it", async () => {
                const delivered: Array<ActivityStream> = [];
                platform.sendToClient = (msg: ActivityStream) => {
                    delivered.push(msg);
                };
                const storedNick = platform.credentials.object.nick;
                const storedActorId = platform.credentials.actor.id;
                const collision =
                    "cannot rename testingham@irc.example.com to Guest12345@irc.example.com: credentials already stored for Guest12345@irc.example.com";
                platform.updateActor = async () => {
                    throw new Error(collision);
                };
                const forced = {
                    "@context": IRC_CONTEXT,
                    type: "update",
                    actor: { type: "person", id: actor.id, name: actor.name },
                    target: {
                        type: "person",
                        id: "Guest12345@irc.example.com",
                        name: "Guest12345",
                    },
                    object: { type: "address" },
                } as ActivityStream;

                platform.irc2as.events.emit("incoming", forced);
                await new Promise((resolve) => setImmediate(resolve));

                // Delivered with the error so the client does not move its
                // replay state onto an account it would then overwrite.
                expect(delivered).toEqual([{ ...forced, error: collision }]);
                expect(platform.credentials.object.nick).toEqual(storedNick);
                expect(platform.credentials.actor.id).toEqual(storedActorId);
                // The socket holds the forced nick regardless.
                expect(platform.handledActors.has(actor.id)).toEqual(false);
                expect(platform.handledActors.has(forced.target.id)).toEqual(
                    true,
                );

                // Whoever takes the released nick must not be adopted.
                const stranger = {
                    "@context": IRC_CONTEXT,
                    type: "update",
                    actor: { type: "person", id: actor.id, name: actor.name },
                    target: {
                        type: "person",
                        id: "other@irc.example.com",
                        name: "other",
                    },
                    object: { type: "address" },
                } as ActivityStream;
                platform.irc2as.events.emit("incoming", stranger);
                await new Promise((resolve) => setImmediate(resolve));
                expect(delivered[1]).toEqual(stranger);
                expect(platform.credentials.actor.id).toEqual(storedActorId);
            });

            it("does not reclaim a released nick when the next command uses it", async () => {
                const delivered: Array<ActivityStream> = [];
                platform.sendToClient = (msg: ActivityStream) => {
                    delivered.push(msg);
                };
                const storedNick = platform.credentials.object.nick;
                const storedActorId = platform.credentials.actor.id;
                let updates = 0;
                platform.updateActor = async () => {
                    updates += 1;
                    if (updates === 1) {
                        throw new Error("redis down");
                    }
                };
                const forced = {
                    "@context": IRC_CONTEXT,
                    type: "update",
                    actor: { type: "person", id: actor.id, name: actor.name },
                    target: {
                        type: "person",
                        id: "Guest12345@irc.example.com",
                        name: "Guest12345",
                    },
                    object: { type: "address" },
                } as ActivityStream;

                platform.irc2as.events.emit("incoming", forced);
                await new Promise((resolve) => setImmediate(resolve));
                expect(platform.handledActors.has(actor.id)).toEqual(false);

                // The client was told the rename failed, so it keeps sending
                // as the nick the server already released.
                let left: unknown = "pending";
                platform.leave(
                    {
                        "@context": IRC_CONTEXT,
                        type: "leave",
                        actor: actor,
                        target: targetRoom,
                    },
                    (err: unknown) => {
                        left = err;
                    },
                );
                expect(left).toBeUndefined();
                expect(platform.handledActors.has(actor.id)).toEqual(false);

                const stranger = {
                    "@context": IRC_CONTEXT,
                    type: "update",
                    actor: { type: "person", id: actor.id, name: actor.name },
                    target: {
                        type: "person",
                        id: "other@irc.example.com",
                        name: "other",
                    },
                    object: { type: "address" },
                } as ActivityStream;
                platform.irc2as.events.emit("incoming", stranger);
                await new Promise((resolve) => setImmediate(resolve));

                expect(updates).toEqual(1);
                expect(delivered[1]).toEqual(stranger);
                expect(platform.credentials.object.nick).toEqual(storedNick);
                expect(platform.credentials.actor.id).toEqual(storedActorId);
                expect(
                    platform.handledActors.has("other@irc.example.com"),
                ).toEqual(false);
                expect(platform.handledActors.has(forced.target.id)).toEqual(
                    true,
                );
            });

            it("does not complete an unrelated in-flight send on forced rename", async () => {
                const delivered: Array<ActivityStream> = [];
                platform.sendToClient = (msg: ActivityStream) => {
                    delivered.push(msg);
                };
                let sendFinished = false;
                platform.send(
                    {
                        "@context": IRC_CONTEXT,
                        type: "send",
                        actor: actor,
                        object: { content: "still sending" },
                        target: targetRoom,
                    } as ActivityStream,
                    () => {
                        sendFinished = true;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));
                expect(platform.jobQueue.length).toEqual(1);

                const forced = {
                    "@context": IRC_CONTEXT,
                    type: "update",
                    actor: { type: "person", id: actor.id, name: actor.name },
                    target: {
                        type: "person",
                        id: "Guest12345@irc.example.com",
                        name: "Guest12345",
                    },
                    object: { type: "address" },
                } as ActivityStream;
                platform.irc2as.events.emit("incoming", forced);
                await new Promise((resolve) => setImmediate(resolve));

                expect(sendFinished).toEqual(false);
                expect(platform.jobQueue.length).toEqual(1);
                expect(delivered).toEqual([forced]);
                expect(platform.handledActors.has(forced.target.id)).toEqual(
                    true,
                );

                platform.completeJob();
                expect(sendFinished).toEqual(true);
            });

            it("still completes an in-flight command from our own nick echo", async () => {
                const creds = structuredClone(validCredentials);
                let finished = false;
                platform.update(
                    {
                        "@context": IRC_CONTEXT,
                        type: "update",
                        actor: actor,
                        object: { type: "address" },
                        target: newActor,
                    },
                    creds,
                    () => {
                        finished = true;
                    },
                );
                await new Promise((resolve) => setImmediate(resolve));

                platform.irc2as.events.emit("incoming", {
                    "@context": IRC_CONTEXT,
                    type: "update",
                    actor: { type: "person", id: actor.id, name: actor.name },
                    target: newActor,
                    object: { type: "address" },
                });
                await new Promise((resolve) => setImmediate(resolve));

                expect(finished).toEqual(true);
                expect(platform.jobQueue.length).toEqual(0);
                expect(platform.handledActors.has(newActor.id)).toEqual(true);
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
                                id: "#a-room@irc.example.com",
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

                it("rejects CR injection in query targets before writing", (done) => {
                    platform.query(
                        {
                            "@context": IRC_CONTEXT,
                            type: "query",
                            actor,
                            target: {
                                type: "room",
                                id: "irc.example.com/#a-room",
                                name: "#a-room\rPRIVMSG victim :injected",
                            },
                            object: { type: "attendance" },
                        },
                        (err) => {
                            expect(err).toContain("must not contain CR or LF");
                            expect(rawCalls).toEqual([]);
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
                            target: { type: "room", id: "irc.example.com" },
                            object: { type: "attendance" },
                        },
                        (err) => {
                            expect(err).toEqual(
                                "IRC room targets must be server-qualified as '#channel@server'",
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

describe("ircConnect TLS certificate validation", () => {
    let platform;

    beforeEach(() => {
        capturedIrcSocketOptions = undefined;
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
    });

    const connect = (credentials) =>
        new Promise((resolve, reject) => {
            platform.ircConnect(credentials, (err) => {
                if (err) {
                    reject(new Error(String(err)));
                    return;
                }
                resolve(undefined);
            });
        });

    it("validates secure server certificates by default", async () => {
        await connect({
            ...validCredentials,
            object: {
                ...validCredentials.object,
                secure: true,
            },
        });

        expect(
            capturedIrcSocketOptions?.connectOptions?.rejectUnauthorized,
        ).toEqual(true);
    });

    it("allows explicit invalid certificate opt-out for secure connections", async () => {
        await connect({
            ...validCredentials,
            object: {
                ...validCredentials.object,
                secure: true,
                allowInvalidCert: true,
            },
        });

        expect(
            capturedIrcSocketOptions?.connectOptions?.rejectUnauthorized,
        ).toEqual(false);
    });

    it("does not set TLS connect options for cleartext connections", async () => {
        await connect({
            ...validCredentials,
            object: {
                ...validCredentials.object,
                secure: false,
            },
        });

        expect(capturedIrcSocketOptions?.connectOptions).toBeUndefined();
    });

    it("registers the actor nick when a rename left the credential nick behind", async () => {
        // A reconnect after a nick change replays the original credential
        // object (so the fingerprint still finds the worker) under the new
        // actor. A fresh worker must register that actor. Registering the
        // stale object.nick leaves handledActors on a nick this socket does
        // not own.
        const credentials = {
            ...validCredentials,
            actor: {
                type: "person",
                id: "alice_away@irc.example.com",
                name: "alice_away",
            },
            object: {
                ...validCredentials.object,
                nick: "alice",
                password: "hunter2",
                secure: false,
            },
        };

        await new Promise((resolve, reject) => {
            platform.connect(
                { type: "connect", actor: credentials.actor },
                credentials,
                (err) => {
                    if (err) {
                        reject(new Error(String(err)));
                        return;
                    }
                    resolve(undefined);
                },
            );
        });

        expect(capturedIrcSocketOptions?.nicknames).toEqual(["alice_away"]);
        expect(capturedIrcSocketOptions?.username).toEqual("alice");
        expect(platform.handledActors.has("alice_away@irc.example.com")).toEqual(
            true,
        );
        expect(platform.handledActors.has("alice@irc.example.com")).toEqual(
            false,
        );
    });

    it("registers object.nick when the actor id is not on this server", async () => {
        await connect({
            ...validCredentials,
            actor: {
                ...validCredentials.actor,
                id: "testingham@other.example",
            },
            object: {
                ...validCredentials.object,
                secure: false,
            },
        });

        expect(capturedIrcSocketOptions?.nicknames).toEqual(["testingham"]);
    });

    it.each([
        ["nick", { object: { nick: "nick\rOPER root" } }],
        ["username", { object: { username: "user\rOPER root" } }],
        ["realname", { actor: { name: "name\rOPER root" } }],
        ["actor nick", { actor: { id: "nick\rOPER@irc.example.com" } }],
    ])("rejects CR injection in connect-time %s", async (_field, override) => {
        const credentials = {
            ...validCredentials,
            ...override,
            actor: { ...validCredentials.actor, ...override.actor },
            object: { ...validCredentials.object, ...override.object },
        };

        await expect(connect(credentials)).rejects.toThrow(
            "must not contain CR or LF",
        );
        expect(capturedIrcSocketOptions).toBeUndefined();
    });
});

describe("TLS connect option flattening", () => {
    it("copies inherited rejectUnauthorized into an own property", () => {
        const inheritedOptions = Object.create({
            rejectUnauthorized: false,
        }) as Record<string, unknown>;

        const flattened = flattenConnectOptions(inheritedOptions);

        expect(
            Object.prototype.hasOwnProperty.call(
                flattened,
                "rejectUnauthorized",
            ),
        ).toEqual(true);
        expect(flattened.rejectUnauthorized).toEqual(false);
    });
});
