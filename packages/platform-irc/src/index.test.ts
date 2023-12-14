import { expect } from "chai";

import schemas, {
    CredentialsObject,
    PlatformCallback,
} from "@sockethub/schemas";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const IRC = require("./index");

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

let loadedSchema = false;

describe("Initialize IRC Platform", () => {
    let platform;
    beforeEach(() => {
        platform = new IRC({
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            debug: function () {},
            updateActor: function async() {
                return Promise.resolve();
            },
        });
        platform.ircConnect = function (
            key: string,
            credentials: CredentialsObject,
            cb: PlatformCallback,
        ) {
            cb(null, {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                end: () => {},
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                on: function () {},
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                raw: () => {},
            });
        };
        if (!loadedSchema) {
            schemas.addPlatformSchema(
                platform.schema.credentials,
                `irc/credentials`,
            );
            loadedSchema = true;
        }
    });

    it("lists required types enum", () => {
        expect(platform.schema.messages.properties.type.enum).to.eql([
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
        expect(platform.config).to.eql({
            persist: true,
            requireCredentials: ["connect", "update"],
            initialized: false,
        });
    });

    it("schema format validation", () => {
        expect(schemas.validatePlatformSchema(platform.schema)).to.equal("");
    });

    describe("credential schema", () => {
        it("valid credentials", () => {
            expect(schemas.validateCredentials(validCredentials)).to.equal("");
        });

        it("invalid credentials type", () => {
            expect(
                schemas.validateCredentials({
                    context: "irc",
                    type: "credentials",
                    // @ts-expect-error test invalid params
                    object: {
                        host: "example.com",
                        port: "6667",
                    },
                }),
            ).to.equal("[irc] /object: must have required property 'type'");
        });

        it("invalid credentials port", () => {
            expect(
                // @ts-expect-error test invalid params
                schemas.validateCredentials({
                    context: "irc",
                    type: "credentials",
                    object: {
                        type: "credentials",
                        host: "example.com",
                        port: "6667",
                    },
                }),
            ).to.equal("[irc] /object/port: must be number");
        });

        it("invalid credentials additional prop", () => {
            expect(
                // @ts-expect-error test invalid params
                schemas.validateCredentials({
                    context: "irc",
                    type: "credentials",
                    object: {
                        type: "credentials",
                        host: "example.com",
                        port: 6667,
                    },
                }),
            ).to.equal(
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
                platform.__completeJob();
            });

            it("has join channel registered", () => {
                expect(platform.__channels.has("#a-room")).to.equal(true);
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
                platform.__completeJob();
            });

            it("send()", (done) => {
                platform.send(
                    {
                        context: "irc",
                        type: "send",
                        actor: actor,
                        object: { content: "har dee dar" },
                        target: targetRoom,
                    },
                    done,
                );
                platform.__completeJob();
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
                platform.__completeJob();
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
                platform.__completeJob();
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
                platform.__completeJob();
            });

            it("cleanup()", (done) => {
                platform.cleanup(() => {
                    expect(platform.initialized).to.eql(false);
                    done();
                });
            });
        });
    });
});
