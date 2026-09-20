import { afterEach, describe, expect, it, mock } from "bun:test";
import {
    observability,
    redactObservabilityLog,
    resetObservabilityForTesting,
    setObservabilityAdapter,
    sanitizeObservabilityNamespace,
    startConnectionTelemetry,
} from "./observability.js";

describe("observability", () => {
    afterEach(() => resetObservabilityForTesting());

    it("is a no-op until an adapter is installed", () => {
        expect(() => observability.count("test.counter")).not.toThrow();
        expect(() => observability.gauge("test.gauge", 1)).not.toThrow();
        expect(() =>
            observability.distribution("test.duration", 2, "millisecond"),
        ).not.toThrow();
        expect(() => observability.startAction("dummy", "echo")()).not.toThrow();
    });

    it("forwards privacy-safe metric dimensions", () => {
        const count = mock(() => {});
        const gauge = mock(() => {});
        const distribution = mock(() => {});
        const finish = mock(() => {});
        const startAction = mock(() => finish);
        setObservabilityAdapter({ count, gauge, distribution, startAction });

        observability.count("sockethub.connection.opened");
        observability.gauge("sockethub.connection.active", 2);
        observability.distribution(
            "sockethub.connection.duration",
            250,
            "millisecond",
        );
        observability.startAction("irc", "join", {
            transport: "socket",
        })(false);

        expect(count).toHaveBeenCalledWith("sockethub.connection.opened");
        expect(gauge).toHaveBeenCalledWith("sockethub.connection.active", 2);
        expect(distribution).toHaveBeenCalledWith(
            "sockethub.connection.duration",
            250,
            "millisecond",
        );
        expect(startAction).toHaveBeenCalledWith("irc", "join", {
            transport: "socket",
        });
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

    it("classifies a connection and counts each platform only once", () => {
        const count = mock(() => {});
        const gauge = mock(() => {});
        const distribution = mock(() => {});
        const startAction = mock(() => () => {});
        setObservabilityAdapter({ count, gauge, distribution, startAction });

        const connection = startConnectionTelemetry();
        connection.recordPlatform("irc");
        connection.recordPlatform("irc");
        connection.recordPlatform("xmpp");
        connection.end();
        connection.end();

        expect(count).toHaveBeenCalledTimes(5);
        expect(count).toHaveBeenCalledWith(
            "sockethub.platform_session.started",
            1,
            { platform: "irc" },
        );
        expect(count).toHaveBeenCalledWith(
            "sockethub.platform_session.started",
            1,
            { platform: "xmpp" },
        );
        expect(count).toHaveBeenCalledWith(
            "sockethub.connection.classified",
            1,
            { classification: "multi_platform" },
        );
        expect(distribution).toHaveBeenCalledWith(
            "sockethub.connection.platform_count",
            2,
            "none",
        );
    });
});
