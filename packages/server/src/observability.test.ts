import { afterEach, describe, expect, it, mock } from "bun:test";
import {
    observability,
    redactObservabilityLog,
    resetObservabilityForTesting,
    setObservabilityAdapter,
    sanitizeObservabilityNamespace,
} from "./observability.js";

describe("observability", () => {
    afterEach(() => resetObservabilityForTesting());

    it("is a no-op until an adapter is installed", () => {
        expect(() => observability.count("test.counter")).not.toThrow();
        expect(() => observability.gauge("test.gauge", 1)).not.toThrow();
        expect(() => observability.startAction("dummy", "echo")()).not.toThrow();
    });

    it("forwards privacy-safe metric dimensions", () => {
        const count = mock(() => {});
        const gauge = mock(() => {});
        const finish = mock(() => {});
        const startAction = mock(() => finish);
        setObservabilityAdapter({ count, gauge, startAction });

        observability.count("sockethub.connection.opened");
        observability.gauge("sockethub.connection.active", 2);
        observability.startAction("irc", "join")(false);

        expect(count).toHaveBeenCalledWith("sockethub.connection.opened");
        expect(gauge).toHaveBeenCalledWith("sockethub.connection.active", 2);
        expect(startAction).toHaveBeenCalledWith("irc", "join");
        expect(finish).toHaveBeenCalledWith(false);
    });

    it("redacts identifiers from logs and namespaces", () => {
        expect(
            redactObservabilityLog(
                "actor nick@example.org from 192.0.2.1 fetched https://example.org/a",
            ),
        ).toBe("actor [address] from [ip] fetched [url]");
        expect(
            sanitizeObservabilityNamespace(
                "sockethub:server:core:private-socket-id",
            ),
        ).toBe("sockethub:server:core");
        expect(
            sanitizeObservabilityNamespace(
                "sockethub:platform:irc:private-actor-id:main",
            ),
        ).toBe("sockethub:platform:irc");
    });
});
