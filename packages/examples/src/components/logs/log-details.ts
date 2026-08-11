export type LogMetadata = {
    timestamp: number;
    sortKey: number;
    requestId?: string;
};

type LogEntries = Record<string, readonly [unknown, unknown]>;

export function resolveLogDetails(
    logs: LogEntries,
    meta: Record<string, LogMetadata>,
    id: string,
) {
    const requestId = meta[id]?.requestId ?? id;
    return {
        sent: logs[requestId]?.[0],
        response: logs[id]?.[1],
    };
}
