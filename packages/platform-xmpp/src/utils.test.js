import { describe, expect, it } from "bun:test";
import parse from "@xmpp/xml/lib/parse.js";

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

    describe("parseXDataField", () => {
        it("ignores fields without var attribute", () => {
            const field = parse("<field label='No Var'><value>test</value></field>");
            expect(utils.parseXDataField(field)).toBeNull();
        });

        it("ignores FORM_TYPE fields", () => {
            const field = parse("<field var='FORM_TYPE'><value>http://jabber.org/protocol/muc#roominfo</value></field>");
            expect(utils.parseXDataField(field)).toBeNull();
        });

        it("parses single text fields with label and option values", () => {
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

        it("coerces boolean true values", () => {
            const field1 = parse("<field var='muc#roominfo_membersonly' type='boolean'><value>true</value></field>");
            const field2 = parse("<field var='muc#roominfo_membersonly' type='boolean'><value>1</value></field>");
            expect(utils.parseXDataField(field1).field.value).toBe(true);
            expect(utils.parseXDataField(field2).field.value).toBe(true);
        });

        it("coerces boolean false values", () => {
            const field1 = parse("<field var='muc#roominfo_membersonly' type='boolean'><value>false</value></field>");
            const field2 = parse("<field var='muc#roominfo_membersonly' type='boolean'><value>0</value></field>");
            const field3 = parse("<field var='muc#roominfo_membersonly' type='boolean'></field>");
            expect(utils.parseXDataField(field1).field.value).toBe(false);
            expect(utils.parseXDataField(field2).field.value).toBe(false);
            expect(utils.parseXDataField(field3).field.value).toBe(false);
        });

        it("coerces numeric digit strings to JS numbers", () => {
            const field = parse("<field var='muc#roominfo_occupants' type='text-single'><value>15</value></field>");
            expect(utils.parseXDataField(field).field.value).toBe(15);
        });

        it("does not coerce alphanumeric values to numbers", () => {
            const field = parse("<field var='muc#roominfo_occupants' type='text-single'><value>15a</value></field>");
            expect(utils.parseXDataField(field).field.value).toBe("15a");
        });

        it("parses multi-value fields into array of strings", () => {
            const field = parse(
                `<field var='muc#roominfo_changes' type='text-multi'>
                    <value>Added feature X</value>
                    <value>Fixed bug Y</value>
                </field>`,
            );
            expect(utils.parseXDataField(field).field.value).toEqual([
                "Added feature X",
                "Fixed bug Y",
            ]);
        });
    });
});
