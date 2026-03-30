import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
    CredentialsNotShareableError,
    type CredentialsStoreInterface,
    type CredentialsValidationOptions,
} from "@sockethub/data-layer";
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
    const clientIp = "203.0.113.10";
    let store: CredentialsStoreInterface;

    beforeEach(() => {
        platformInstances.clear();
        store = {
            get: async () =>
                makeCredentials({ type: "credentials", password: "secret" }),
            save: async () => 1,
        };
    });

    afterEach(() => {
        platformInstances.clear();
    });

    test("passes through when there is no shared session", async () => {
        store.get = async () =>
            makeCredentials({ type: "credentials", password: "abc123" });

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(store, socketId, clientIp)(baseMessage, resolve);
        });

        expect(result).toEqual(baseMessage);
    });

    test("uses data-layer session-share validation when another session exists", async () => {
        store.get = async (
            actor: string,
            credentialsHash: string | undefined,
            options: CredentialsValidationOptions | undefined,
        ) => {
            expect(actor).toEqual(baseMessage.actor.id);
            expect(credentialsHash).toBeUndefined();
            expect(options).toEqual({ validateSessionShare: true });
            return makeCredentials({ type: "credentials", password: "abc123" });
        };
        const key = getPlatformId(baseMessage.context, baseMessage.actor.id);
        platformInstances.set(
            key,
            {
                sessions: new Set(["socket-2"]),
                sessionIps: new Map([["socket-2", clientIp]]),
            } as any,
        );

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(store, socketId, clientIp)(baseMessage, resolve);
        });

        expect(result).toEqual(baseMessage);
    });

    test("allows when only this session is attached", async () => {
        store.get = async () =>
            makeCredentials({ type: "credentials", password: "abc123" });
        const key = getPlatformId(baseMessage.context, baseMessage.actor.id);
        platformInstances.set(
            key,
            {
                sessions: new Set([socketId]),
                sessionIps: new Map([[socketId, clientIp]]),
            } as any,
        );

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(store, socketId, clientIp)(baseMessage, resolve);
        });

        expect(result).toEqual(baseMessage);
    });

    test("allows anonymous reconnect when prior session is stale and IP matches", async () => {
        store.get = async () =>
            Promise.reject(new CredentialsNotShareableError("username already in use"));
        const key = getPlatformId(baseMessage.context, baseMessage.actor.id);
        platformInstances.set(
            key,
            {
                sessions: new Set(["socket-2"]),
                sessionIps: new Map([["socket-2", clientIp]]),
            } as any,
        );

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(
                store,
                socketId,
                clientIp,
                () => false,
            )(baseMessage, resolve);
        });

        expect(result).toEqual(baseMessage);
    });

    test("blocks anonymous reconnect when prior session IP differs", async () => {
        store.get = async () =>
            Promise.reject(new CredentialsNotShareableError("username already in use"));
        const key = getPlatformId(baseMessage.context, baseMessage.actor.id);
        platformInstances.set(
            key,
            {
                sessions: new Set(["socket-2"]),
                sessionIps: new Map([["socket-2", "198.51.100.7"]]),
            } as any,
        );

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(
                store,
                socketId,
                clientIp,
                () => false,
            )(baseMessage, resolve);
        });

        expect(result instanceof Error).toEqual(true);
        expect(result.toString()).toEqual("Error: username already in use");
    });

    test("blocks anonymous reconnect when prior session is still active", async () => {
        store.get = async () =>
            Promise.reject(new CredentialsNotShareableError("username already in use"));
        const key = getPlatformId(baseMessage.context, baseMessage.actor.id);
        platformInstances.set(
            key,
            {
                sessions: new Set(["socket-2"]),
                sessionIps: new Map([["socket-2", clientIp]]),
            } as any,
        );

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(
                store,
                socketId,
                clientIp,
                (sid) => sid === "socket-2",
            )(baseMessage, resolve);
        });

        expect(result instanceof Error).toEqual(true);
        expect(result.toString()).toEqual("Error: username already in use");
    });
});
