import { describe, it } from "mocha";
import { expect } from "chai";
import { CredentialsStore } from "../packages/data-layer/src/index";
import { CredentialsObject } from "packages/data-layer/src/credentials-store";

// eslint-disable-next-line security-node/detect-insecure-randomness
const actor = "" + (Math.random() + 1).toString(36).substring(2);
const creds: CredentialsObject = {
    type: "credentials",
    context: "bar",
    actor: {
        type: "person",
        id: actor,
    },
    object: {
        type: "credentials",
    },
};
const credsHash = "e591ec978a505aee278f372354c229d165d2c096";
const secret = "baz1234567890baz1234567890abcdef";

describe("CredentialsStore", () => {
    let store: CredentialsStore;
    it("initializes", () => {
        store = new CredentialsStore(
            "foo",
            "bar",
            secret,
            "redis://localhost:10651",
        );
    });

    it("get non-existant value", async () => {
        try {
            await store.get(actor, credsHash);
            throw new Error("test should not reach this point");
        } catch (err) {
            expect(err).to.eql(
                "credentials record not found for key: " + actor,
            );
        }
    });

    it("save", (done) => {
        store.save(actor, creds, done);
    });

    it("get", async () => {
        expect(await store.get(actor, credsHash)).to.eql(creds);
    });
});
