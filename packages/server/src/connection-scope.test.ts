import { beforeEach, describe, expect, it } from "bun:test";
import type { CredentialsObject } from "@sockethub/schemas";

import {
    beginCredentialScope,
    clearSessionScopes,
    forgetAnonymousScopes,
    rememberAnonymousScope,
    reassignAnonymousScopes,
    type ResumptionRef,
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
                first.resumption as ResumptionRef,
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
                first.resumption as ResumptionRef,
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
                before.resumption as ResumptionRef,
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
                connect.resumption as ResumptionRef,
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
                first.resumption as ResumptionRef,
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

        it("does not let a colliding session strand the one that owns the record", async () => {
            // Two anonymous clients behind one NAT ask for the same nick.
            const ip = "10.0.0.1";
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: ip,
            });
            rememberAnonymousScope(
                first.resumption as ResumptionRef,
                first.scope,
                "instance-1",
                "s1",
            );

            // s1 is still connected, so s2 gets a worker of its own.
            connectedSockets(["s1", "s2"]);
            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: ip,
            });
            expect(second.scope).toEqual("s2");
            rememberAnonymousScope(
                second.resumption as ResumptionRef,
                second.scope,
                "instance-2",
                "s2",
            );

            // s2's remote connect fails (the nick is taken) and its worker is
            // torn down. That must not take s1's record with it.
            forgetAnonymousScopes("instance-2");

            // s1 refreshes and has to land back on its own live worker.
            connectedSockets(["s3"]);
            const refreshed = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s3",
                sessionIp: ip,
            });
            expect(refreshed.scope).toEqual(first.scope);
        });

        it("hands the record on once the owning session is gone", async () => {
            const ip = "10.0.0.1";
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: ip,
            });
            rememberAnonymousScope(
                first.resumption as ResumptionRef,
                first.scope,
                "instance-1",
                "s1",
            );

            // s1 has gone, so s2 inherits and becomes the record's owner.
            connectedSockets(["s2"]);
            const second = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s2",
                sessionIp: ip,
            });
            rememberAnonymousScope(
                second.resumption as ResumptionRef,
                second.scope,
                "instance-1",
                "s2",
            );

            connectedSockets(["s3"]);
            const third = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s3",
                sessionIp: ip,
            });
            expect(third.scope).toEqual(first.scope);
        });

        it("keeps actors whose ids contain colons apart", async () => {
            // `actor.id` is an unconstrained string, so it can carry colons of
            // its own. These two tuples must not collide.
            const a = await resolveConnectionScope(PLATFORM, "xmpp:alice", {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                a.resumption as ResumptionRef,
                a.scope,
                "instance-1",
                "s1",
            );

            const b = await resolveConnectionScope(PLATFORM, "xmpp", {
                socketSessionId: "s2",
                sessionIp: "alice:10.0.0.1",
            });
            expect(b.scope).toEqual("s2");
        });

        it("survives a rename for an actor id containing colons", async () => {
            const actor = "xmpp:alice@example.org";
            const first = await resolveConnectionScope(PLATFORM, actor, {
                socketSessionId: "s1",
                sessionIp: "2001:db8::1",
            });
            rememberAnonymousScope(
                first.resumption as ResumptionRef,
                first.scope,
                "instance-1",
                "s1",
            );

            const renamed = "xmpp:alice_away@example.org";
            reassignAnonymousScopes(
                "instance-1",
                "instance-2",
                PLATFORM,
                renamed,
            );

            const second = await resolveConnectionScope(PLATFORM, renamed, {
                socketSessionId: "s2",
                sessionIp: "2001:db8::1",
            });
            expect(second.scope).toEqual(first.scope);
        });

        it("does not share a scope across addresses", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumption as ResumptionRef,
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
                first.resumption as ResumptionRef,
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
                first.resumption as ResumptionRef,
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

        it("survives a rename for an IPv6 client", async () => {
            // An IPv6 address contains colons, so a resumption key cannot be
            // split on the last one: "2001:db8::1" would come back as "1".
            const ip = "2001:db8::1";
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: ip,
            });
            rememberAnonymousScope(
                first.resumption as ResumptionRef,
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

            const second = await resolveConnectionScope(PLATFORM, renamed, {
                socketSessionId: "s2",
                sessionIp: ip,
            });
            expect(second.scope).toEqual(first.scope);
        });

        it("keeps IPv6 clients on different addresses apart after a rename", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "2001:db8::1",
            });
            rememberAnonymousScope(
                first.resumption as ResumptionRef,
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

            // Shares the final key segment with the address above; must not
            // be treated as the same client.
            const other = await resolveConnectionScope(PLATFORM, renamed, {
                socketSessionId: "s2",
                sessionIp: "2001:db8::2",
            });
            expect(other.scope).toEqual("s2");
        });

        it("clears a re-keyed instance's records on shutdown", async () => {
            const first = await resolveConnectionScope(PLATFORM, ACTOR, {
                socketSessionId: "s1",
                sessionIp: "10.0.0.1",
            });
            rememberAnonymousScope(
                first.resumption as ResumptionRef,
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
                first.resumption as ResumptionRef,
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
                first.resumption as ResumptionRef,
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
                first.resumption as ResumptionRef,
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
