type Attributes = Record<string, string | number | boolean>;

export interface ObservabilityAdapter {
    count(name: string, value?: number, attributes?: Attributes): void;
    gauge(name: string, value: number, attributes?: Attributes): void;
    startAction(platform: string, action: string): (error?: boolean) => void;
}

const noopAdapter: ObservabilityAdapter = {
    count: () => {},
    gauge: () => {},
    startAction: () => () => {},
};

let adapter = noopAdapter;

export function setObservabilityAdapter(next: ObservabilityAdapter): void {
    adapter = next;
}

export const observability: ObservabilityAdapter = {
    count: (...args) => adapter.count(...args),
    gauge: (...args) => adapter.gauge(...args),
    startAction: (...args) => adapter.startAction(...args),
};

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
