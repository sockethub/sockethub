const cache = new Map<string, string[]>();
const MAX_CACHE_ENTRIES = 256;
const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

function formatter(timeZone: string) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        timeZoneName: "short",
    });
}

function localParts(format: Intl.DateTimeFormat, instant: number) {
    const parts = Object.fromEntries(
        format
            .formatToParts(new Date(instant))
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value]),
    );
    const values = {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
        name: parts.timeZoneName ?? "",
    };
    return {
        ...values,
        offset:
            Date.UTC(
                values.year,
                values.month - 1,
                values.day,
                values.hour,
                values.minute,
                values.second,
            ) -
            Math.floor(instant / 1000) * 1000,
    };
}

function offsetValue(milliseconds: number): string {
    const sign = milliseconds < 0 ? "-" : "+";
    const minutes = Math.abs(milliseconds) / 60_000;
    return `${sign}${String(Math.floor(minutes / 60)).padStart(2, "0")}${String(minutes % 60).padStart(2, "0")}`;
}

function transitionDateTime(instant: number, offset: number): string {
    return new Date(instant + offset)
        .toISOString()
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replace(/\.\d{3}Z$/, "");
}

/** Build a self-contained VTIMEZONE from the runtime's current IANA tzdata. */
export function timeZoneLines(
    timeZone: string,
    firstYear: number,
    lastYear: number,
): string[] {
    const first = Math.min(Math.max(firstYear, MIN_YEAR), MAX_YEAR);
    const last = Math.min(Math.max(lastYear, first), MAX_YEAR);
    const cacheKey = `${timeZone}:${first}:${last}`;
    const existing = cache.get(cacheKey);
    if (existing) return existing;
    const format = formatter(timeZone);
    const start = Date.UTC(first, 0, 1);
    const end = Date.UTC(last + 1, 0, 1);
    const step = 7 * 24 * 60 * 60 * 1000;
    let previousInstant = start;
    let previous = localParts(format, previousInstant);
    const transitions: Array<{
        from: number;
        to: number;
        instant: number;
        at: ReturnType<typeof localParts>;
    }> = [];

    for (let instant = start + step; instant <= end; instant += step) {
        const current = localParts(format, instant);
        if (current.offset !== previous.offset) {
            let low = previousInstant;
            let high = instant;
            while (high - low > 1000) {
                const middle = Math.floor((low + high) / 2000) * 1000;
                if (localParts(format, middle).offset === previous.offset)
                    low = middle;
                else high = middle;
            }
            const at = localParts(format, high);
            transitions.push({
                from: previous.offset,
                to: at.offset,
                instant: high,
                at,
            });
        }
        previousInstant = instant;
        previous = current;
    }

    const lines = ["BEGIN:VTIMEZONE", `TZID:${timeZone}`];
    if (transitions.length === 0) {
        lines.push(
            "BEGIN:STANDARD",
            `DTSTART:${first}0101T000000`,
            `TZOFFSETFROM:${offsetValue(previous.offset)}`,
            `TZOFFSETTO:${offsetValue(previous.offset)}`,
            ...(previous.name ? [`TZNAME:${previous.name}`] : []),
            "END:STANDARD",
        );
    } else {
        for (const transition of transitions) {
            const kind =
                transition.to > transition.from ? "DAYLIGHT" : "STANDARD";
            lines.push(
                `BEGIN:${kind}`,
                `DTSTART:${transitionDateTime(transition.instant, transition.from)}`,
                `TZOFFSETFROM:${offsetValue(transition.from)}`,
                `TZOFFSETTO:${offsetValue(transition.to)}`,
                ...(transition.at.name ? [`TZNAME:${transition.at.name}`] : []),
                `END:${kind}`,
            );
        }
    }
    lines.push("END:VTIMEZONE");
    if (cache.size >= MAX_CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(cacheKey, lines);
    return lines;
}
