import { describe, expect, test } from "bun:test";
import parse from "@xmpp/xml/lib/parse.js";

import type { XmppCredentialsObject } from "./types.js";
import { utils } from "./utils.js";

describe("Utils", () => {
    describe("buildXmppCredentials", () => {
        test("returns correct credential object used for xmpp.js connect", () => {
            expect(
                utils.buildXmppCredentials({
                    object: {
                        type: "credentials",
                        userAddress: "barney@dinosaur.com.au",
                        password: "bar",
                        resource: "Home",
                    },
                } as XmppCredentialsObject),
            ).toEqual({
                password: "bar",
                service: "dinosaur.com.au",
                domain: "dinosaur.com.au",
                username: "barney",
                resource: "Home",
            });
        });

        test("allows overriding server value", () => {
            expect(
                utils.buildXmppCredentials({
                    object: {
                        type: "credentials",
                        userAddress: "barney@dinosaur.com.au",
                        server: "foo",
                        password: "bar",
                        resource: "Home",
                    },
                } as XmppCredentialsObject),
            ).toEqual({
                password: "bar",
                service: "foo",
                domain: "dinosaur.com.au",
                username: "barney",
                resource: "Home",
            });
        });

        test("throws when userAddress has no @ sign", () => {
            expect(() =>
                utils.buildXmppCredentials({
                    object: { type: "credentials", userAddress: "barney", password: "bar", resource: "Home" },
                } as XmppCredentialsObject),
            ).toThrow("JID");
        });

        test("throws when userAddress is an empty string", () => {
            expect(() =>
                utils.buildXmppCredentials({
                    object: { type: "credentials", userAddress: "", password: "bar", resource: "Home" },
                } as XmppCredentialsObject),
            ).toThrow("JID");
        });

        test("throws when userAddress is null", () => {
            expect(() =>
                utils.buildXmppCredentials({
                    object: { type: "credentials", userAddress: null, password: "bar", resource: "Home" },
                } as unknown as XmppCredentialsObject),
            ).toThrow("JID");
        });

        test("throws when userAddress is undefined", () => {
            expect(() =>
                utils.buildXmppCredentials({
                    object: { type: "credentials", password: "bar", resource: "Home" },
                } as unknown as XmppCredentialsObject),
            ).toThrow("JID");
        });

        test("throws when userAddress has no username before @", () => {
            expect(() =>
                utils.buildXmppCredentials({
                    object: { type: "credentials", userAddress: "@dinosaur.com.au", password: "bar", resource: "Home" },
                } as XmppCredentialsObject),
            ).toThrow("missing the username or server portion");
        });

        test("throws when userAddress has no server after @", () => {
            expect(() =>
                utils.buildXmppCredentials({
                    object: { type: "credentials", userAddress: "barney@", password: "bar", resource: "Home" },
                } as XmppCredentialsObject),
            ).toThrow("missing the username or server portion");
        });

        test("throws when userAddress is only @", () => {
            expect(() =>
                utils.buildXmppCredentials({
                    object: { type: "credentials", userAddress: "@", password: "bar", resource: "Home" },
                } as XmppCredentialsObject),
            ).toThrow("missing the username or server portion");
        });

        test("allows a custom port", () => {
            expect(
                utils.buildXmppCredentials({
                    object: {
                        type: "credentials",
                        userAddress: "barney@dinosaur.com.au",
                        port: 123,
                        password: "bar",
                        resource: "Home",
                    },
                } as XmppCredentialsObject),
            ).toEqual({
                password: "bar",
                service: "xmpp://dinosaur.com.au:123",
                domain: "dinosaur.com.au",
                username: "barney",
                resource: "Home",
            });
        });

        const withServer = (server: string, port?: number) =>
            utils.buildXmppCredentials({
                object: {
                    type: "credentials",
                    userAddress: "barney@dinosaur.com.au",
                    server,
                    port,
                    password: "bar",
                    resource: "Home",
                },
            } as XmppCredentialsObject).service;

        test("accepts xmpp:// and xmpps:// service URIs", () => {
            expect(withServer("xmpp://localhost:5222")).toBe("xmpp://localhost:5222");
            expect(withServer("xmpps://chat.example.org")).toBe("xmpps://chat.example.org");
            expect(withServer("xmpp://chat.example.org/")).toBe("xmpp://chat.example.org");
            expect(withServer("xmpp://[2001:db8::1]:5222")).toBe("xmpp://[2001:db8::1]:5222");
        });

        test("accepts an internationalized host only as a bare host without a port", () => {
            expect(withServer("bücher.example")).toBe("bücher.example");
            expect(() => withServer("bücher.example", 5222)).toThrow("credentials.object.server");
            expect(() => withServer("xmpps://bücher.example:5223")).toThrow("credentials.object.server");
            expect(withServer("xmpps://xn--bcher-kva.example:5223")).toBe("xmpps://xn--bcher-kva.example:5223");
        });

        test("the port field overrides the URI port and pins a bare host", () => {
            expect(withServer("xmpp://chat.example.org:5222", 5269)).toBe("xmpp://chat.example.org:5269");
            expect(withServer("chat.example.org", 5223)).toBe("xmpp://chat.example.org:5223");
        });

        test.each([
            "ws://127.0.0.1:8080/v-verifier/path?x=1",
            "wss://example.org/xmpp-websocket",
            "https://example.org",
            "xmpp://example.org/path",
            "xmpp://example.org?x=1",
            "xmpp://user:pw@example.org",
            "127.0.0.1:8080",
            "example.org/path",
            "::1",
            "not a host",
            "xmpp://example.org%2Fpath",
            "xmpp://example.org%00",
            "xmpp://example.org:0",
            "example.org%2Fpath",
        ])("rejects server value %p", (server) => {
            expect(() => withServer(server)).toThrow("credentials.object.server");
        });

        test("rejects a userAddress server portion that is not a host", () => {
            expect(() =>
                utils.buildXmppCredentials({
                    object: {
                        type: "credentials",
                        userAddress: "barney@127.0.0.1:8080",
                        password: "bar",
                        resource: "Home",
                    },
                } as XmppCredentialsObject),
            ).toThrow("must be a host name");
        });
    });

    describe("parseXDataField", () => {
        test("ignores fields without var attribute", () => {
            const field = parse("<field label='No Var'><value>test</value></field>");
            expect(utils.parseXDataField(field)).toBeNull();
        });

        test("ignores FORM_TYPE fields", () => {
            const field = parse("<field var='FORM_TYPE'><value>http://jabber.org/protocol/muc#roominfo</value></field>");
            expect(utils.parseXDataField(field)).toBeNull();
        });

        test("parses single text fields with label and option values", () => {
            const field = parse(
                `<field var='muc#roominfo_contact' type='text-single' label='Contact Address'>
                    <value>admin@example.org</value>
                    <option label='Admin'><value>admin@example.org</value></option>
                </field>`,
            );
            expect(utils.parseXDataField(field)).toEqual({
                var: "muc#roominfo_contact",
                field: {
                    type: "text-single",
                    label: "Contact Address",
                    value: "admin@example.org",
                    options: [
                        { label: "Admin", value: "admin@example.org" },
                    ],
                },
            });
        });

        test("coerces boolean true values", () => {
            const field1 = parse("<field var='muc#roominfo_membersonly' type='boolean'><value>true</value></field>");
            const field2 = parse("<field var='muc#roominfo_membersonly' type='boolean'><value>1</value></field>");
            expect(utils.parseXDataField(field1)!.field.value).toBe(true);
            expect(utils.parseXDataField(field2)!.field.value).toBe(true);
        });

        test("coerces boolean false values", () => {
            const field1 = parse("<field var='muc#roominfo_membersonly' type='boolean'><value>false</value></field>");
            const field2 = parse("<field var='muc#roominfo_membersonly' type='boolean'><value>0</value></field>");
            const field3 = parse("<field var='muc#roominfo_membersonly' type='boolean'></field>");
            expect(utils.parseXDataField(field1)!.field.value).toBe(false);
            expect(utils.parseXDataField(field2)!.field.value).toBe(false);
            expect(utils.parseXDataField(field3)!.field.value).toBe(false);
        });

        test("coerces numeric digit strings to JS numbers", () => {
            const field = parse("<field var='muc#roominfo_occupants' type='text-single'><value>15</value></field>");
            expect(utils.parseXDataField(field)!.field.value).toBe(15);
        });

        test("does not coerce alphanumeric values to numbers", () => {
            const field = parse("<field var='muc#roominfo_occupants' type='text-single'><value>15a</value></field>");
            expect(utils.parseXDataField(field)!.field.value).toBe("15a");
        });

        test("parses multi-value fields into array of strings", () => {
            const field = parse(
                `<field var='muc#roominfo_changes' type='text-multi'>
                    <value>Added feature X</value>
                    <value>Fixed bug Y</value>
                </field>`,
            );
            expect(utils.parseXDataField(field)!.field.value).toEqual([
                "Added feature X",
                "Fixed bug Y",
            ]);
        });
    });
});
