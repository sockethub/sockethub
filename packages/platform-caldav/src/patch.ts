import { parseICalendar } from "./ical.js";
import type { CalendarObjectInput } from "./types.js";

/**
 * A content line or VALARM block of the stored component, kept as its raw
 * physical lines so an untouched property is written back unchanged.
 */
interface Unit {
    name: string;
    raw: string[];
}

/**
 * Item fields and the iCalendar properties each group owns. A group is
 * rewritten only when one of its fields differs from the stored item, so an
 * unchanged attendee keeps parameters the item model does not carry.
 */
const GROUPS: Array<{
    fields: Array<keyof CalendarObjectInput>;
    names: string[];
}> = [
    { fields: ["name"], names: ["SUMMARY"] },
    { fields: ["content"], names: ["DESCRIPTION"] },
    { fields: ["location"], names: ["LOCATION"] },
    { fields: ["url"], names: ["URL"] },
    {
        fields: ["startTime", "endTime", "due", "allDay", "timeZone"],
        names: ["DTSTART", "DTEND", "DUE"],
    },
    { fields: ["status"], names: ["STATUS"] },
    { fields: ["completedTime"], names: ["COMPLETED"] },
    { fields: ["percentComplete"], names: ["PERCENT-COMPLETE"] },
    { fields: ["sequence"], names: ["SEQUENCE"] },
    { fields: ["recurrence"], names: ["RRULE"] },
    { fields: ["organizer"], names: ["ORGANIZER"] },
    { fields: ["attendees"], names: ["ATTENDEE"] },
    { fields: ["attachments"], names: ["ATTACH"] },
    { fields: ["reminders"], names: ["VALARM"] },
    // Revision stamps change on every write.
    { fields: [], names: ["DTSTAMP", "LAST-MODIFIED"] },
];

/** Raw lines grouped into logical lines (a line plus its folded continuations). */
function logicalLines(body: string): string[][] {
    const lines: string[][] = [];
    for (const line of body.split(/\r?\n/)) {
        if (/^[ \t]/.test(line) && lines.length)
            lines[lines.length - 1].push(line);
        else lines.push([line]);
    }
    while (lines.length && lines[lines.length - 1].join("") === "") lines.pop();
    return lines;
}

const unfolded = (raw: string[]) =>
    raw.map((line, index) => (index ? line.slice(1) : line)).join("");

const propertyName = (raw: string[]) =>
    (unfolded(raw).match(/^[^;:]*/)?.[0] ?? "").toUpperCase();

/** Index of the first event or task BEGIN line and its matching END line. */
function componentBounds(
    lines: string[][],
): { begin: number; end: number; name: string } | undefined {
    const begin = lines.findIndex((raw) =>
        /^BEGIN:(?:VEVENT|VTODO)$/.test(unfolded(raw)),
    );
    if (begin === -1) return undefined;
    const name = unfolded(lines[begin]).slice("BEGIN:".length);
    const end = lines.findIndex(
        (raw, index) => index > begin && unfolded(raw) === `END:${name}`,
    );
    return end === -1 ? undefined : { begin, end, name };
}

/** The component's content lines and VALARM blocks, in order. */
function units(lines: string[][]): Unit[] {
    const result: Unit[] = [];
    let alarm: string[] | undefined;
    for (const raw of lines) {
        const text = unfolded(raw);
        if (alarm) {
            alarm.push(...raw);
            if (text === "END:VALARM") {
                result.push({ name: "VALARM", raw: alarm });
                alarm = undefined;
            }
        } else if (text === "BEGIN:VALARM") alarm = [...raw];
        else result.push({ name: propertyName(raw), raw });
    }
    // An alarm that never closes is not one; keep its lines as they were.
    if (alarm) result.push({ name: "", raw: alarm });
    return result;
}

/** Order-insensitive for object keys; `undefined` and absent are equal. */
function canonical(value: unknown): string {
    return JSON.stringify(value, (_key, entry) =>
        entry && typeof entry === "object" && !Array.isArray(entry)
            ? Object.fromEntries(
                  Object.keys(entry)
                      .sort()
                      .map((key) => [key, entry[key]]),
              )
            : entry,
    );
}

function sameField(
    current: CalendarObjectInput,
    next: CalendarObjectInput,
    field: keyof CalendarObjectInput,
): boolean {
    if (field === "allDay")
        return (current.allDay === true) === (next.allDay === true);
    return canonical(current[field]) === canonical(next[field]);
}

/**
 * Apply an item to the stored iCalendar resource it was read from. Only the
 * properties of fields that changed are replaced with `generated` (the
 * item's own `buildICalendar` output); every other property, parameter,
 * component, and `VTIMEZONE` stays as stored. A field the item omits removes
 * its property. When the component type changes, `generated` replaces the
 * whole resource.
 */
export function patchICalendar(
    stored: string,
    item: CalendarObjectInput,
    generated: string,
): { uid: string; body: string } {
    const current = parseICalendar(stored, "");
    if (current.type !== item.type)
        return { uid: item.uid ?? current.uid, body: generated };
    const lines = logicalLines(stored);
    const bounds = componentBounds(lines);
    const fresh = logicalLines(generated);
    const freshBounds = componentBounds(fresh);
    if (!bounds || !freshBounds) throw new Error("invalid calendar data");
    const freshUnits = units(
        fresh.slice(freshBounds.begin + 1, freshBounds.end),
    );
    const replaced = new Set<string>();
    for (const group of GROUPS)
        if (
            !group.fields.length ||
            !group.fields.every((field) => sameField(current, item, field))
        )
            for (const name of group.names) replaced.add(name);
    const freshNames = new Set(freshUnits.map((unit) => unit.name));
    // A new end replaces a stored DURATION; RFC 5545 allows only one of them.
    if (
        replaced.has("DTSTART") &&
        (freshNames.has("DTEND") || freshNames.has("DUE"))
    )
        replaced.add("DURATION");

    const kept: Unit[] = [];
    let insertAt: number | undefined;
    for (const unit of units(lines.slice(bounds.begin + 1, bounds.end))) {
        if (replaced.has(unit.name)) insertAt ??= kept.length;
        else kept.push(unit);
    }
    const added = freshUnits.filter((unit) => replaced.has(unit.name));
    kept.splice(insertAt ?? kept.length, 0, ...added);

    // A new TZID needs its VTIMEZONE; keep stored ones, add a missing one.
    const zone = item.timeZone;
    const freshZone = fresh.findIndex(
        (raw) => unfolded(raw) === "BEGIN:VTIMEZONE",
    );
    const zones =
        zone &&
        replaced.has("DTSTART") &&
        freshZone !== -1 &&
        freshZone < freshBounds.begin &&
        !lines
            .slice(0, bounds.begin)
            .concat(lines.slice(bounds.end + 1))
            .some((raw) => unfolded(raw) === `TZID:${zone}`)
            ? fresh.slice(freshZone, freshBounds.begin)
            : [];

    const output = [
        ...lines.slice(0, bounds.begin),
        ...zones,
        lines[bounds.begin],
        ...kept.map((unit) => unit.raw),
        ...lines.slice(bounds.end),
    ].flat();
    return { uid: current.uid, body: `${output.join("\r\n")}\r\n` };
}
