import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    test,
} from "bun:test";
import {
    buildCredentialsKey,
    CredentialsMismatchError,
    CredentialsNotShareableError,
    type CredentialsStoreInterface,
    type CredentialsValidationOptions,
    SESSION_SHARE_DENIED,
} from "@sockethub/data-layer";
import {
    type ActivityStream,
    addPlatformContext,
    buildCanonicalContext,
    type CredentialsObject,
    resolvePlatformId,
} from "@sockethub/schemas";

import { getPlatformId } from "@sockethub/util/crypto";
import { platformInstances } from "../platform-instance.js";
import credentialCheck from "./credential-check.js";

const IRC_CONTEXT_URL =
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld";

const baseMessage: ActivityStream = {
    "@context": buildCanonicalContext(IRC_CONTEXT_URL),
    type: "connect",
    actor: { id: "nick@irc.example.com", type: "person" },
};

function makeCredentials(
    object: CredentialsObject["object"],
): CredentialsObject {
    return {
        "@context": buildCanonicalContext(IRC_CONTEXT_URL),
        type: "credentials",
        actor: baseMessage.actor,
        object,
    };
}

describe("Middleware: credentialCheck", () => {
    const socketId = "socket-1";
    const clientIp = "203.0.113.10";
    let store: CredentialsStoreInterface;
    let platformKey: string;

    beforeAll(() => {
        addPlatformContext("irc", IRC_CONTEXT_URL);
        platformKey = getPlatformId(
            resolvePlatformId(baseMessage) ?? "",
            baseMessage.actor.id,
        );
    });

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
            expect(actor).toEqual(buildCredentialsKey("irc", baseMessage.actor.id));
            expect(credentialsHash).toBeUndefined();
            expect(options).toEqual({ validateSessionShare: true });
            return makeCredentials({ type: "credentials", password: "abc123" });
        };
        platformInstances.set(
            platformKey,
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
        platformInstances.set(
            platformKey,
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

    // Regression: the incumbent's credentials hash must reach the data layer,
    // otherwise the exact-match comparison is skipped and any non-empty
    // password attaches to another client's live connection.
    it("passes the incumbent's credentialsHash to the store", async () => {
        let seenHash: string | undefined | symbol = Symbol("unset");
        store.get = async (
            _actor: string,
            credentialsHash: string | undefined,
            options: CredentialsValidationOptions | undefined,
        ) => {
            seenHash = credentialsHash;
            expect(options).toEqual({ validateSessionShare: true });
            return makeCredentials({ type: "credentials", password: "abc123" });
        };
        platformInstances.set(platformKey, {
            sessions: new Set(["socket-2"]),
            sessionIps: new Map([["socket-2", clientIp]]),
            credentialsHash: "incumbent-hash",
            // biome-ignore lint/suspicious/noExplicitAny: test double
        } as any);

        await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(store, socketId, clientIp)(baseMessage, resolve);
        });

        expect(seenHash).toEqual("incumbent-hash");
    });

    it("blocks an attach whose credentials do not match the incumbent", async () => {
        store.get = async () =>
            Promise.reject(
                new CredentialsMismatchError(
                    "invalid credentials for nick@irc.example.com",
                ),
            );
        platformInstances.set(platformKey, {
            sessions: new Set(["socket-2"]),
            sessionIps: new Map([["socket-2", clientIp]]),
            credentialsHash: "incumbent-hash",
            // biome-ignore lint/suspicious/noExplicitAny: test double
        } as any);

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(store, socketId, clientIp)(baseMessage, resolve);
        });

        expect(result instanceof Error).toEqual(true);
    });

    it("a credentials mismatch is not eligible for same-IP reconnect", async () => {
        // Same IP and a stale prior session — the escape hatch that rescues an
        // anonymous reconnect must not rescue a wrong-password attach.
        store.get = async () =>
            Promise.reject(
                new CredentialsMismatchError(
                    "invalid credentials for nick@irc.example.com",
                ),
            );
        platformInstances.set(platformKey, {
            sessions: new Set(["socket-2"]),
            sessionIps: new Map([["socket-2", clientIp]]),
            credentialsHash: "incumbent-hash",
            // biome-ignore lint/suspicious/noExplicitAny: test double
        } as any);

        const result = await new Promise<ActivityStream | Error>((resolve) => {
            credentialCheck(
                store,
                socketId,
                clientIp,
                () => false,
            )(baseMessage, resolve);
        });

        expect(result instanceof Error).toEqual(true);
    });

    // Regression: the incumbent's hash is unset for the whole remote
    // handshake. Admitting an attach on the non-empty rule alone during that
    // window failed open — registration is sticky and an attached session
    // skips this middleware on later messages, so it stayed attached once the
    // hash finally arrived.
    describe("before the incumbent's credentials are known", () => {
        it("refuses a persistent-platform attach when the hash never arrives", async () => {
            store.get = async () =>
                makeCredentials({ type: "credentials", password: "abc123" });
            platformInstances.set(platformKey, {
                sessions: new Set(["socket-2"]),
                sessionIps: new Map([["socket-2", clientIp]]),
                config: { persist: true },
                credentialsHash: undefined,
                waitForCredentialsHash: async () => undefined,
                // biome-ignore lint/suspicious/noExplicitAny: test double
            } as any);

            const result = await new Promise<ActivityStream | Error>(
                (resolve) => {
                    credentialCheck(store, socketId, clientIp)(
                        baseMessage,
                        resolve,
                    );
                },
            );

            expect(result instanceof Error).toEqual(true);
            expect(result.toString()).toEqual(
                `Error: ${SESSION_SHARE_DENIED}`,
            );
        });

        it("admits a concurrent connect once the hash arrives and matches", async () => {
            // Two clients connecting with the same credentials: the second
            // waits for the first to finish rather than being refused.
            let seenHash: string | undefined;
            store.get = async (
                _actor: string,
                credentialsHash: string | undefined,
            ) => {
                seenHash = credentialsHash;
                return makeCredentials({
                    type: "credentials",
                    password: "abc123",
                });
            };
            platformInstances.set(platformKey, {
                sessions: new Set(["socket-2"]),
                sessionIps: new Map([["socket-2", clientIp]]),
                config: { persist: true },
                credentialsHash: undefined,
                waitForCredentialsHash: async () => "late-hash",
                // biome-ignore lint/suspicious/noExplicitAny: test double
            } as any);

            const result = await new Promise<ActivityStream | Error>(
                (resolve) => {
                    credentialCheck(store, socketId, clientIp)(
                        baseMessage,
                        resolve,
                    );
                },
            );

            expect(result).toEqual(baseMessage);
            expect(seenHash).toEqual("late-hash");
        });

        it("refuses an attacker racing the incumbent's connect", async () => {
            // The hostile variant of the concurrent-connect case: B submits
            // the same actor.id with a different password while A is still
            // authenticating. B must wait for A's hash and then be refused,
            // never registered — before the fail-closed change it was admitted
            // here and never re-checked afterwards.
            store.get = async (
                _actor: string,
                credentialsHash: string | undefined,
            ) => {
                if (credentialsHash === "victims-hash") {
                    throw new CredentialsMismatchError(
                        "invalid credentials for nick@irc.example.com",
                    );
                }
                return makeCredentials({
                    type: "credentials",
                    password: "attacker-arbitrary",
                });
            };
            platformInstances.set(platformKey, {
                sessions: new Set(["socket-2"]),
                sessionIps: new Map([["socket-2", "198.51.100.9"]]),
                config: { persist: true },
                credentialsHash: undefined,
                // A's connect completes while B is waiting.
                waitForCredentialsHash: async () => "victims-hash",
                // biome-ignore lint/suspicious/noExplicitAny: test double
            } as any);

            const result = await new Promise<ActivityStream | Error>(
                (resolve) => {
                    credentialCheck(store, socketId, clientIp)(
                        baseMessage,
                        resolve,
                    );
                },
            );

            expect(result instanceof Error).toEqual(true);
        });

        it("does not wait for non-persistent platforms", async () => {
            // Nothing publishes a hash for these, and there is no long-lived
            // connection to join, so the original rule still applies.
            let waited = false;
            store.get = async () =>
                makeCredentials({ type: "credentials", password: "abc123" });
            platformInstances.set(platformKey, {
                sessions: new Set(["socket-2"]),
                sessionIps: new Map([["socket-2", clientIp]]),
                config: { persist: false },
                credentialsHash: undefined,
                waitForCredentialsHash: async () => {
                    waited = true;
                    return undefined;
                },
                // biome-ignore lint/suspicious/noExplicitAny: test double
            } as any);

            const result = await new Promise<ActivityStream | Error>(
                (resolve) => {
                    credentialCheck(store, socketId, clientIp)(
                        baseMessage,
                        resolve,
                    );
                },
            );

            expect(result).toEqual(baseMessage);
            expect(waited).toEqual(false);
        });
    });

    test("allows anonymous reconnect when prior session is stale and IP matches", async () => {
        store.get = async () =>
            Promise.reject(new CredentialsNotShareableError(SESSION_SHARE_DENIED));
        platformInstances.set(
            platformKey,
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
            Promise.reject(new CredentialsNotShareableError(SESSION_SHARE_DENIED));
        platformInstances.set(
            platformKey,
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
        expect(result.toString()).toEqual(`Error: ${SESSION_SHARE_DENIED}`);
    });

    test("blocks anonymous reconnect when prior session is still active", async () => {
        store.get = async () =>
            Promise.reject(new CredentialsNotShareableError(SESSION_SHARE_DENIED));
        platformInstances.set(
            platformKey,
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
        expect(result.toString()).toEqual(`Error: ${SESSION_SHARE_DENIED}`);
    });
});
