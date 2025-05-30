import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as sinon from "sinon";

import type { CredentialsObject } from "@sockethub/schemas";
import storeCredentials from "./store-credentials.js";

const creds: CredentialsObject = {
    type: "credentials",
    context: "dummy",
    actor: {
        id: "dood@irc.freenode.net",
        type: "person",
        name: "dood",
    },
    target: {
        id: "irc.freenode.net/service",
        type: "person",
        name: "service",
    },
    object: {
        type: "credentials",
    },
};

describe("Middleware: storeCredentials", () => {
    let storeSuccess: any,
        storeError: any,
        saveErrorFake: any,
        saveSuccessFake: any;

    beforeEach(() => {
        storeSuccess = {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            save: async (id: any, creds: any) => {
                return Promise.resolve();
            },
        };
        storeError = {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            save: (id: any, creds: any): Promise<void> => {
                throw new Error("some error");
            },
        };
        saveSuccessFake = sinon.replace(
            storeSuccess,
            "save",
            sinon.fake(storeSuccess.save),
        );
        saveErrorFake = sinon.replace(
            storeError,
            "save",
            sinon.fake(storeError.save),
        );
    });

    afterEach(() => {
        sinon.reset();
    });

    it("returns a middleware handler", () => {
        const sc = storeCredentials(storeSuccess);
        expect(typeof sc).toEqual("function");
        expect(saveSuccessFake.callCount).toEqual(0);
    });

    it("successfully stores credentials", (done) => {
        const sc = storeCredentials(storeSuccess);
        sc(creds as CredentialsObject, (err: any) => {
            expect(saveSuccessFake.callCount).toEqual(1);
            expect(saveSuccessFake.firstArg).toEqual(creds.actor.id);
            expect(err).toEqual(creds);
            done();
        });
    });

    it("handle error while storing credentials", (done) => {
        const sc = storeCredentials(storeError);
        sc(creds as CredentialsObject, (err: any) => {
            expect(saveErrorFake.callCount).toEqual(1);
            expect(saveErrorFake.firstArg).toEqual(creds.actor.id);
            expect(err.toString()).toEqual("Error: some error");
            done();
        });
    });
});
