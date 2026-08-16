import { describe, expect, it } from "bun:test";

import {
    buildCredentialsKey,
    buildCredentialsStoreId,
    buildQueueId,
} from "./queue-id";

describe("queue-id helpers", () => {
    it("buildQueueId uses canonical namespace", () => {
        expect(buildQueueId("parent", "platform")).toBe(
            "sockethub:parent:data-layer:queue:platform",
        );
    });

    it("buildCredentialsStoreId uses canonical namespace", () => {
        expect(buildCredentialsStoreId("parent", "session")).toBe(
            "sockethub:parent:data-layer:credentials-store:session",
        );
    });
});

describe("buildCredentialsKey", () => {
    it("scopes an actor id by platform", () => {
        expect(buildCredentialsKey("irc", "alice@example.org")).toEqual(
            "irc:alice@example.org",
        );
    });

    it("keeps the same actor id on two platforms distinct", () => {
        // Regression: keyed by actor alone, saving XMPP credentials silently
        // overwrote the IRC credentials for the same visible id.
        expect(buildCredentialsKey("irc", "alice@example.org")).not.toEqual(
            buildCredentialsKey("xmpp", "alice@example.org"),
        );
    });
});
