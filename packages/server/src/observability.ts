type Attributes = Record<string, string | number | boolean>;

export interface ObservabilityAdapter {
    count(name: string, value?: number, attributes?: Attributes): void;
    gauge(name: string, value: number, attributes?: Attributes): void;
    distribution(
        name: string,
        value: number,
        unit: string,
        attributes?: Attributes,
    ): void;
    startAction(
        platform: string,
        action: string,
        attributes?: Attributes,
    ): (error?: boolean) => void;
}

const noopAdapter: ObservabilityAdapter = {
    count: () => {},
    gauge: () => {},
    distribution: () => {},
    startAction: () => () => {},
};

let adapter = noopAdapter;

export function setObservabilityAdapter(next: ObservabilityAdapter): void {
    adapter = next;
}

export const observability: ObservabilityAdapter = {
    count: (...args) => adapter.count(...args),
    gauge: (...args) => adapter.gauge(...args),
    distribution: (...args) => adapter.distribution(...args),
    startAction: (...args) => adapter.startAction(...args),
};

export interface ConnectionTelemetry {
    recordPlatform(platform: string): void;
    end(): void;
}

/**
 * Aggregate one socket connection without exporting its socket/session id.
 * Platform names have already come from the validated registry by the time
 * recordPlatform is called.
 */
export function startConnectionTelemetry(): ConnectionTelemetry {
    const startedAt = performance.now();
    const platforms = new Set<string>();
    let ended = false;

    observability.count("sockethub.connection.opened");

    return {
        recordPlatform(platform: string): void {
            if (ended || platforms.has(platform)) {
                return;
            }
            platforms.add(platform);
            observability.count("sockethub.platform_session.started", 1, {
                platform,
            });
        },
        end(): void {
            if (ended) {
                return;
            }
            ended = true;
            observability.count("sockethub.connection.closed");
            observability.distribution(
                "sockethub.connection.duration",
                performance.now() - startedAt,
                "millisecond",
            );
            const classification =
                platforms.size === 0
                    ? "inactive"
                    : platforms.size === 1
                      ? "single_platform"
                      : "multi_platform";
            observability.count("sockethub.connection.classified", 1, {
                classification,
            });
            observability.distribution(
                "sockethub.connection.platform_count",
                platforms.size,
                "none",
            );
        },
    };
}

export function resetObservabilityForTesting(): void {
    adapter = noopAdapter;
}

/** Remove common network/user identifiers before forwarding operational logs. */
export function redactObservabilityLog(message: string): string {
    return message
        .replace(/https?:\/\/\S+/gi, "[url]")
        .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "[address]")
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]")
        .replace(/\b[0-9a-f]{0,4}:[0-9a-f:]{2,}\b/gi, "[ip]");
}

/** Collapse namespaces containing per-session or per-actor identifiers. */
export function sanitizeObservabilityNamespace(namespace: string): string {
    const parts = namespace.split(":");
    const dynamicMarker = parts.findIndex(
        (part, index) =>
            index > 0 &&
            (part === "platform-instance" ||
                (part === "core" && parts[index - 1] === "server")),
    );
    if (dynamicMarker >= 0) {
        return parts.slice(0, dynamicMarker + 1).join(":");
    }
    if (parts[1] === "platform") {
        return parts.slice(0, 3).join(":");
    }
    return namespace;
}
