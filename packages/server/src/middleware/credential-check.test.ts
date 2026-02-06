import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";

import { getPlatformId } from "@sockethub/crypto";
import { platformInstances } from "../platform-instance.js";
import credentialCheck from "./credential-check.js";

const baseMessage: ActivityStream = {
    context: "irc",
    type: "connect",
    actor: { id: "nick@irc.example.com", type: "person" },
};

function makeCredentials(
    object: CredentialsObject["object"],
): CredentialsObject {
    return {
        context: "irc",
        type: "credentials",
        actor: baseMessage.actor,
        object,
    };
}

describe("Middleware: credentialCheck", () => {
    const socketId = "socket-1";
    let store: CredentialsStoreInterface;

    beforeEach(() => {
        platformInstances.clear();
        store = {
            get: async () => makeCredentials({ type: "credentials" }),
            save: async () => 1,
        };
    });

    afterEach(() => {
        platformInstances.clear();
    });

    it("passes through when credentials are non-empty", async () => {
        store.get = async () =>
            makeCredentials({ type: "credentials", token: "abc123" });

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(store, socketId)(baseMessage, resolve);
        });

        expect(result).toEqual(baseMessage);
    });

    it("blocks when credentials are empty and another session exists", async () => {
        store.get = async () => makeCredentials({} as CredentialsObject["object"]);
        const key = getPlatformId(baseMessage.context, baseMessage.actor.id);
        platformInstances.set(
            key,
            { sessions: new Set(["socket-2"]) } as any,
        );

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(store, socketId)(baseMessage, resolve);
        });

        expect(result instanceof Error).toEqual(true);
        expect(result.toString()).toEqual("Error: invalid credentials");
    });

    it("allows when credentials are empty but only this session is attached", async () => {
        store.get = async () => makeCredentials({} as CredentialsObject["object"]);
        const key = getPlatformId(baseMessage.context, baseMessage.actor.id);
        platformInstances.set(
            key,
            { sessions: new Set([socketId]) } as any,
        );

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(store, socketId)(baseMessage, resolve);
        });

        expect(result).toEqual(baseMessage);
    });

    it("treats credential lookup failures as non-shareable", async () => {
        store.get = async () => {
            throw new Error("missing creds");
        };
        const key = getPlatformId(baseMessage.context, baseMessage.actor.id);
        platformInstances.set(
            key,
            { sessions: new Set(["socket-2"]) } as any,
        );

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(store, socketId)(baseMessage, resolve);
        });

        expect(result instanceof Error).toEqual(true);
        expect(result.toString()).toEqual("Error: invalid credentials");
    });
});
