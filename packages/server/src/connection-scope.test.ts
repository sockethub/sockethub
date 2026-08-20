import { beforeEach, describe, expect, it } from "bun:test";
import type { CredentialsObject } from "@sockethub/schemas";

import {
    beginCredentialScope,
    clearSessionScopes,
    forgetAnonymousScopes,
    rememberAnonymousScope,
    reassignAnonymousScopes,
    resetConnectionScopes,
    resolveConnectionScope,
} from "./connection-scope.js";
import listener from "./listener.js";

const PLATFORM = "irc";
const ACTOR = "alice@irc.example.org";

function credentials(object: Record<string, unknown>): CredentialsObject {
    return {
        "@context": [],
        type: "credentials",
        actor: { id: ACTOR, type: "person" },
        object: { type: "credentials", ...object },
    } as unknown as CredentialsObject;
}

/**
 * `socketIsLive()` reads socket.io's live namespace map. Stand in a plain Map
 * so tests can say which sessions are still connected.
 */
function connectedSockets(ids: Array<string>) {
    (listener as unknown as { io: unknown }).io = {
        sockets: { sockets: new Map(ids.map((id) => [id, {}])) },
    };
}

describe("connection scope", () => {
    beforeEach(() => {
        resetConnectionScopes();
        connectedSockets([]);
    });

    describe("credentialed sessions", () => {
        it("uses a fingerprint of the submitted credentials", async () => {
            const handle = beginCredentialScope("s1", PLATFORM, ACTOR);
            handle.resolve(credentials({ nick: "alice", password: "hunter2" }));

            const { scope } = await resolveConnectionScope(PLATFORM, ACTOR, {
                credentialSessionId: "s1",
                socketSessionId: "s1",
            });
            expect(scope).toBeString();
            expect(scope).not.toEqual("s1");
        });

        it("gives identical credentials the same scope across sessions", async () => {
            const object = { nick: "alice", password: "hunter2" };
            beginCredentialScope("s1", PLATFORM, ACTOR).resolve(
                credentials(object),
            );
            beginCredentialScope("s2", PLATFORM, ACTOR).resolve(
                credentials(object),
            );

            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                credentialSessionId: "s1",
                socketSessionId: "s1",
            });
            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                credentialSessionId: "s2",
                socketSessionId: "s2",
            });
            expect(first.scope).toEqual(second.scope);
        });

        it("gives different credentials different scopes for the same actor", async () => {
            beginCredentialScope("s1", PLATFORM, ACTOR).resolve(
                credentials({ nick: "alice", password: "hunter2" }),
            );
            beginCredentialScope("s2", PLATFORM, ACTOR).resolve(
                credentials({ nick: "alice", password: "guessing" }),
            );

            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                credentialSessionId: "s1",
                socketSessionId: "s1",
            });
            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                credentialSessionId: "s2",
                socketSessionId: "s2",
            });
            expect(first.scope).not.toEqual(second.scope);
        });

        it("gives the same credentials the same scope on every platform", async () => {
            const object = { nick: "alice", password: "hunter2" };
            beginCredentialScope("s1", "irc", ACTOR).resolve(
                credentials(object),
            );
            beginCredentialScope("s1", "xmpp", ACTOR).resolve(
                credentials(object),
            );

            const irc = await resolveConnectionScope("irc", ACTOR, {
                credentialSessionId: "s1",
                socketSessionId: "s1",
            });
            const xmpp = await resolveConnectionScope("xmpp", ACTOR, {
                credentialSessionId: "s1",
                socketSessionId: "s1",
            });
            // Same fingerprint, but the platform is a separate input to the
            // instance key, so these cannot collide.
            expect(irc.scope).toEqual(xmpp.scope);
        });

        it("waits for credentials that are still being stored", async () => {
            const handle = beginCredentialScope("s1", PLATFORM, ACTOR);
            const pending = resolveConnectionScope(PLATFORM, ACTOR, {
                credentialSessionId: "s1",
                socketSessionId: "s1",
            });

            let settled = false;
            void pending.then(() => {
                settled = true;
            });
            await Promise.resolve();
            expect(settled).toBeFalse();

            handle.resolve(credentials({ nick: "alice", token: "abc123" }));
            const { scope } = await pending;
            expect(scope).not.toEqual("s1");
        });

        it("propagates a credentials failure instead of falling back", async () => {
            const handle = beginCredentialScope("s1", PLATFORM, ACTOR);
            const pending = resolveConnectionScope(PLATFORM, ACTOR, {
                credentialSessionId: "s1",
                socketSessionId: "s1",
            });
            handle.reject(new Error("redis down"));

            await expect(pending).rejects.toThrow("redis down");
        });

        it("treats credentials with no secret as anonymous", async () => {
            beginCredentialScope("s1", PLATFORM, ACTOR).resolve(
                credentials({ nick: "alice" }),
            );
            const { scope } = await resolveConnectionScope(PLATFORM, ACTOR, {
                credentialSessionId: "s1",
                socketSessionId: "s1",
            });
            expect(scope).toEqual("s1");
        });

        it("drops a session's scopes when the session ends", async () => {
            beginCredentialScope("s1", PLATFORM, ACTOR).resolve(
                credentials({ nick: "alice", password: "hunter2" }),
            );
            clearSessionScopes("s1");

            const { scope } = await resolveConnectionScope(PLATFORM, ACTOR, {
                credentialSessionId: "s1",
                socketSessionId: "s1",
            });
            expect(scope).toEqual("s1");
        });
    });

    describe("anonymous sessions", () => {
        it("resolves immediately when no credentials were sent", async () => {
            const { scope } = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            expect(scope).toEqual("s1");
        });

        it("keeps two sessions apart", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.2",
            });
            expect(first.scope).not.toEqual(second.scope);
        });

        it("lets a refreshed client reclaim its scope", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumptionKey as string,
                first.scope,
                "instance-1",
                "s1",
            );

            // s1's socket is gone; the refreshed page arrives as s2.
            connectedSockets([]);
            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.1",
            });
            expect(second.scope).toEqual(first.scope);
        });

        it("keeps one scope across repeated actions from the same session", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumptionKey as string,
                first.scope,
                "instance-1",
                "s1",
            );

            // s1 is connected, and asking again for its own connection. Its
            // own liveness must not stop it reusing the scope it just took.
            connectedSockets(["s1"]);
            const again = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            expect(again.scope).toEqual(first.scope);
        });

        it("keeps one scope for every action after a refresh", async () => {
            const before = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                before.resumptionKey as string,
                before.scope,
                "instance-1",
                "s1",
            );

            // s1 goes away, s2 refreshes in and claims the scope.
            connectedSockets(["s2"]);
            const connect = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                connect.resumptionKey as string,
                connect.scope,
                "instance-1",
                "s2",
            );

            // The action that follows must land on the same connection.
            const join = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.1",
            });
            expect(connect.scope).toEqual(before.scope);
            expect(join.scope).toEqual(before.scope);
        });

        it("does not hand a live session's scope to another client", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumptionKey as string,
                first.scope,
                "instance-1",
                "s1",
            );

            // Same NAT, same nick, but s1 is still connected.
            connectedSockets(["s1"]);
            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.1",
            });
            expect(second.scope).toEqual("s2");
        });

        it("does not share a scope across addresses", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumptionKey as string,
                first.scope,
                "instance-1",
                "s1",
            );

            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.9",
            });
            expect(second.scope).toEqual("s2");
        });

        it("normalizes IPv4-mapped addresses", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumptionKey as string,
                first.scope,
                "instance-1",
                "s1",
            );

            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: "::ffff:10.0.0.1",
            });
            expect(second.scope).toEqual(first.scope);
        });

        it("follows the instance when a rename re-keys it", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumptionKey as string,
                first.scope,
                "instance-1",
                "s1",
            );

            // The nick changes, so the worker is re-keyed under a new actor.
            const renamed = "alice_away@irc.example.org";
            reassignAnonymousScopes(
                "instance-1",
                "instance-2",
                PLATFORM,
                renamed,
            );

            // A refresh now sends the new actor, and must still find it.
            const second = await resolveConnectionScope(PLATFORM, renamed, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.1",
            });
            expect(second.scope).toEqual(first.scope);
        });

        it("clears a re-keyed instance's records on shutdown", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumptionKey as string,
                first.scope,
                "instance-1",
                "s1",
            );

            const renamed = "alice_away@irc.example.org";
            reassignAnonymousScopes(
                "instance-1",
                "instance-2",
                PLATFORM,
                renamed,
            );
            // Teardown uses the current identifier; the record must go with it
            // rather than linger under the one it was created with.
            forgetAnonymousScopes("instance-2");

            const second = await resolveConnectionScope(PLATFORM, renamed, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.1",
            });
            expect(second.scope).toEqual("s2");
        });

        it("drops the record when a re-key has no new actor", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumptionKey as string,
                first.scope,
                "instance-1",
                "s1",
            );

            reassignAnonymousScopes("instance-1", "instance-2", PLATFORM);

            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.1",
            });
            expect(second.scope).toEqual("s2");
        });

        it("refuses to resolve a scope with no session at all", async () => {
            await expect(
                resolveConnectionScope(PLATFORM, ACTOR, {
                    sessionIp: "10.0.0.1",
                }),
            ).rejects.toThrow("without a session");
        });

        it("cannot inherit a scope once its worker is gone", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumptionKey as string,
                first.scope,
                "instance-1",
                "s1",
            );

            forgetAnonymousScopes("instance-1");

            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.1",
            });
            expect(second.scope).toEqual("s2");
        });

        it("leaves scopes for other instances alone", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumptionKey as string,
                first.scope,
                "instance-1",
                "s1",
            );

            forgetAnonymousScopes("instance-2");

            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: "10.0.0.1",
            });
            expect(second.scope).toEqual(first.scope);
        });
    });
});
