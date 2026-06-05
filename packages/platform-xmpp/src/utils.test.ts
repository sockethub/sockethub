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
                service: "dinosaur.com.au:123",
                username: "barney",
                resource: "Home",
            });
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
