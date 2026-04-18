import { describe, expect, it } from "bun:test";

import { utils } from "./utils.js";

describe("Utils", () => {
    describe("buildXmppCredentials", () => {
        it("returns correct credential object used for xmpp.js connect", () => {
            expect(
                utils.buildXmppCredentials({
                    object: {
                        userAddress: "barney@dinosaur.com.au",
                        password: "bar",
                        resource: "Home",
                    },
                }),
            ).toEqual({
                password: "bar",
                service: "dinosaur.com.au",
                username: "barney",
                resource: "Home",
            });
        });
        it("uses token in the password slot when token is provided", () => {
            expect(
                utils.buildXmppCredentials({
                    object: {
                        userAddress: "barney@dinosaur.com.au",
                        token: "t0k3n",
                        resource: "Home",
                    },
                }),
            ).toEqual({
                password: "t0k3n",
                service: "dinosaur.com.au",
                username: "barney",
                resource: "Home",
            });
        });
        // Schema validation rejects dual-secret credentials before runtime,
        // but the helper still behaves deterministically if malformed input
        // slips through a lower-level unit test.
        it("defensively prefers token over password when handed invalid dual-secret input", () => {
            expect(
                utils.buildXmppCredentials({
                    object: {
                        userAddress: "barney@dinosaur.com.au",
                        token: "t0k3n",
                        password: "bar",
                        resource: "Home",
                    },
                }),
            ).toEqual({
                password: "t0k3n",
                service: "dinosaur.com.au",
                username: "barney",
                resource: "Home",
            });
        });
    });
    it("allows overriding server value", () => {
        expect(
            utils.buildXmppCredentials({
                object: {
                    userAddress: "barney@dinosaur.com.au",
                    server: "foo",
                    password: "bar",
                    resource: "Home",
                },
            }),
        ).toEqual({
            password: "bar",
            service: "foo",
            username: "barney",
            resource: "Home",
        });
    });
    it("allows a custom port", () => {
        expect(
            utils.buildXmppCredentials({
                object: {
                    userAddress: "barney@dinosaur.com.au",
                    port: 123,
                    password: "bar",
                    resource: "Home",
                },
            }),
        ).toEqual({
            password: "bar",
            service: "dinosaur.com.au:123",
            username: "barney",
            resource: "Home",
        });
    });
});
