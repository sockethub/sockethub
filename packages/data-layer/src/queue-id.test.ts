import { describe, expect, it } from "bun:test";

import { buildCredentialsStoreId, buildQueueId } from "./queue-id";

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
