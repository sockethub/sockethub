import { randomUUID } from "node:crypto";
import type {
    AttachmentInput,
    CalendarItem,
    CalendarObjectInput,
    PersonInput,
    RecurrenceInput,
    ReminderInput,
} from "./types.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_WITH_ZONE =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const LOCAL_DATE_TIME =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
const DURATION =
    /^-?P(?=\d|T\d)(?:\d+W|(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?)$/;

function escapeText(value: string): string {
    return value
        .replaceAll("\\", "\\\\")
        .replaceAll("\r\n", "\\n")
        .replaceAll("\n", "\\n")
        .replaceAll("\r", "\\n")
        .replaceAll(";", "\\;")
        .replaceAll(",", "\\,");
}

function unescapeText(value: string): string {
    return value
        .replaceAll(/\\[nN]/g, "\n")
        .replaceAll("\\,", ",")
        .replaceAll("\\;", ";")
        .replaceAll("\\\\", "\\");
}

function utcDateTime(value: string, field: string): string {
    if (!DATE_TIME_WITH_ZONE.test(value))
        throw new Error(`${field} must include a UTC offset`);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error(`invalid ${field}`);
    return parsed
        .toISOString()
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replace(/\.\d{3}Z$/, "Z");
}

function dateValue(value: string, field: string): string {
    if (!DATE_ONLY.test(value)) throw new Error(`${field} must be YYYY-MM-DD`);
    const parsed = new Date(`${value}T00:00:00Z`);
    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value
    )
        throw new Error(`invalid ${field}`);
    return value.replaceAll("-", "");
}

function localDateTime(value: string, field: string): string {
    if (!LOCAL_DATE_TIME.test(value))
        throw new Error(
            `${field} must be a local date-time when timeZone is used`,
        );
    return value
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replace(/\.\d{1,3}$/, "");
}

function validTimeZone(value: string): string {
    try {
        new Intl.DateTimeFormat("en", { timeZone: value }).format();
        return value;
    } catch {
        throw new Error("invalid timeZone");
    }
}

function temporalLine(
    name: string,
    value: string,
    allDay: boolean,
    timeZone?: string,
): string {
    if (allDay)
        return `${name};VALUE=DATE:${dateValue(value, name.toLowerCase())}`;
    if (timeZone)
        return `${name};TZID=${validTimeZone(timeZone)}:${localDateTime(value, name.toLowerCase())}`;
    return `${name}:${utcDateTime(value, name.toLowerCase())}`;
}

/** Fold one iCalendar content line at 75 UTF-8 octets (74 after continuation). */
export function foldLine(line: string): string {
    const output: string[] = [];
    let current = "";
    let limit = 75;
    for (const character of line) {
        if (Buffer.byteLength(current + character, "utf8") > limit && current) {
            output.push(current);
            current = character;
            limit = 74;
        } else current += character;
    }
    output.push(current);
    return output.join("\r\n ");
}

function recurrenceLine(value: RecurrenceInput): string {
    const parts = [`FREQ=${value.frequency.toUpperCase()}`];
    if (value.interval) parts.push(`INTERVAL=${value.interval}`);
    if (value.count) parts.push(`COUNT=${value.count}`);
    if (value.until)
        parts.push(`UNTIL=${utcDateTime(value.until, "recurrence.until")}`);
    if (value.byDay?.length)
        parts.push(`BYDAY=${value.byDay.join(",").toUpperCase()}`);
    if (value.byMonthDay?.length)
        parts.push(`BYMONTHDAY=${value.byMonthDay.join(",")}`);
    if (value.count && value.until)
        throw new Error("recurrence cannot contain both count and until");
    return `RRULE:${parts.join(";")}`;
}

function personLine(
    name: "ORGANIZER" | "ATTENDEE",
    person: PersonInput,
): string {
    const params: string[] = [];
    if (person.name) params.push(`CN=${escapeText(person.name)}`);
    if (name === "ATTENDEE") {
        if (person.role) params.push(`ROLE=${person.role.toUpperCase()}`);
        if (person.status)
            params.push(`PARTSTAT=${person.status.toUpperCase()}`);
        if (person.rsvp !== undefined)
            params.push(`RSVP=${person.rsvp ? "TRUE" : "FALSE"}`);
    }
    return `${name}${params.length ? `;${params.join(";")}` : ""}:mailto:${person.email}`;
}

function alarmLines(reminder: ReminderInput): string[] {
    const action = (reminder.action ?? "display").toUpperCase();
    const trigger = DURATION.test(reminder.trigger)
        ? reminder.trigger
        : utcDateTime(reminder.trigger, "reminder.trigger");
    if (action === "EMAIL" && !reminder.recipients?.length)
        throw new Error("email reminder requires recipients");
    return [
        "BEGIN:VALARM",
        `ACTION:${action}`,
        `TRIGGER:${trigger}`,
        `DESCRIPTION:${escapeText(reminder.description ?? "Reminder")}`,
        ...(action === "EMAIL"
            ? [
                  "SUMMARY:Reminder",
                  ...(reminder.recipients ?? []).map(
                      (email) => `ATTENDEE:mailto:${email}`,
                  ),
              ]
            : []),
        "END:VALARM",
    ];
}

function attachmentLine(attachment: AttachmentInput): string {
    if ((attachment.url ? 1 : 0) + (attachment.data ? 1 : 0) !== 1)
        throw new Error("attachment requires exactly one of url or data");
    const params: string[] = [];
    if (attachment.mediaType) params.push(`FMTTYPE=${attachment.mediaType}`);
    if (attachment.filename)
        params.push(`FILENAME=${escapeText(attachment.filename)}`);
    if (attachment.data) params.push("ENCODING=BASE64", "VALUE=BINARY");
    return `ATTACH${params.length ? `;${params.join(";")}` : ""}:${attachment.url ?? attachment.data}`;
}

function compareTimes(
    start: string | undefined,
    end: string | undefined,
    allDay: boolean,
    timeZone?: string,
) {
    if (!start || !end || timeZone) return;
    const startValue = allDay
        ? dateValue(start, "startTime")
        : utcDateTime(start, "startTime");
    const endValue = allDay
        ? dateValue(end, "endTime")
        : utcDateTime(end, "endTime");
    if (endValue <= startValue)
        throw new Error("end/due must be after startTime");
}

export function buildICalendar(
    input: CalendarObjectInput,
    now = new Date(),
): { uid: string; body: string } {
    const uid = input.uid ?? `${randomUUID()}@sockethub`;
    if (/\r|\n/.test(uid)) throw new Error("invalid uid");
    const allDay = input.allDay === true;
    if (allDay && input.timeZone)
        throw new Error("all-day objects cannot have timeZone");
    compareTimes(
        input.startTime,
        input.type === "event" ? input.endTime : input.due,
        allDay,
        input.timeZone,
    );
    const component = input.type === "event" ? "VEVENT" : "VTODO";
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        "PRODID:-//Sockethub//CalDAV Platform//EN",
        `BEGIN:${component}`,
        `UID:${escapeText(uid)}`,
        `DTSTAMP:${utcDateTime(now.toISOString(), "now")}`,
        `SUMMARY:${escapeText(input.name)}`,
    ];
    if (input.content) lines.push(`DESCRIPTION:${escapeText(input.content)}`);
    if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`);
    if (input.url) lines.push(`URL:${input.url}`);
    if (input.startTime)
        lines.push(
            temporalLine("DTSTART", input.startTime, allDay, input.timeZone),
        );
    if (input.type === "event" && input.endTime)
        lines.push(
            temporalLine("DTEND", input.endTime, allDay, input.timeZone),
        );
    if (input.type === "task" && input.due)
        lines.push(temporalLine("DUE", input.due, allDay, input.timeZone));
    if (input.type === "task" && input.status)
        lines.push(`STATUS:${input.status.toUpperCase()}`);
    if (input.type === "task" && input.completedTime)
        lines.push(
            `COMPLETED:${utcDateTime(input.completedTime, "completedTime")}`,
        );
    if (input.type === "task" && input.percentComplete !== undefined)
        lines.push(`PERCENT-COMPLETE:${input.percentComplete}`);
    if (input.sequence !== undefined) lines.push(`SEQUENCE:${input.sequence}`);
    if (input.recurrence) lines.push(recurrenceLine(input.recurrence));
    if (input.organizer) lines.push(personLine("ORGANIZER", input.organizer));
    for (const attendee of input.attendees ?? [])
        lines.push(personLine("ATTENDEE", attendee));
    for (const attachment of input.attachments ?? [])
        lines.push(attachmentLine(attachment));
    for (const reminder of input.reminders ?? [])
        lines.push(...alarmLines(reminder));
    lines.push(`END:${component}`, "END:VCALENDAR");
    return { uid, body: `${lines.map(foldLine).join("\r\n")}\r\n` };
}

function parseDate(value: string): string {
    if (/^\d{8}$/.test(value))
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    if (/^\d{8}T\d{6}Z$/.test(value))
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
    if (/^\d{8}T\d{6}$/.test(value))
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`;
    return value;
}

/** Parse the interoperable item fields returned by CalDAV multiget/query responses. */
export function parseICalendar(
    body: string,
    id: string,
    etag?: string,
): CalendarItem {
    const unfolded = body.replace(/\r?\n[ \t]/g, "");
    const component = unfolded.includes("BEGIN:VTODO") ? "task" : "event";
    const componentName = component === "task" ? "VTODO" : "VEVENT";
    const section = unfolded.match(
        new RegExp(
            `BEGIN:${componentName}\\r?\\n([\\s\\S]*?)\\r?\\nEND:${componentName}`,
        ),
    )?.[1];
    if (!section) throw new Error("invalid calendar data");
    const alarmBlocks = [
        ...section.matchAll(/BEGIN:VALARM\r?\n([\s\S]*?)\r?\nEND:VALARM/g),
    ].map((match) => match[1]);
    const componentSection = section.replace(
        /BEGIN:VALARM\r?\n[\s\S]*?\r?\nEND:VALARM/g,
        "",
    );
    const values = new Map<string, { params: string; value: string }[]>();
    for (const line of componentSection.split(/\r?\n/)) {
        const colon = line.indexOf(":");
        if (colon < 1) continue;
        const head = line.slice(0, colon);
        const [rawName, ...params] = head.split(";");
        const name = rawName.toUpperCase();
        const list = values.get(name) ?? [];
        list.push({ params: params.join(";"), value: line.slice(colon + 1) });
        values.set(name, list);
    }
    const first = (name: string) => values.get(name)?.[0];
    const uid = first("UID")?.value;
    const summary = first("SUMMARY")?.value;
    if (!uid || !summary)
        throw new Error("calendar item is missing UID or SUMMARY");
    const start = first("DTSTART");
    const end = first("DTEND");
    const due = first("DUE");
    const timeZone = start?.params.match(/(?:^|;)TZID=([^;]+)/i)?.[1];
    const item: CalendarItem = {
        id,
        etag,
        type: component,
        uid: unescapeText(uid),
        name: unescapeText(summary),
    };
    if (first("DESCRIPTION"))
        item.content = unescapeText(first("DESCRIPTION")?.value ?? "");
    if (first("LOCATION"))
        item.location = unescapeText(first("LOCATION")?.value ?? "");
    if (first("URL")) item.url = first("URL")?.value;
    if (start) item.startTime = parseDate(start.value);
    if (end) item.endTime = parseDate(end.value);
    if (due) item.due = parseDate(due.value);
    if (start?.params.includes("VALUE=DATE")) item.allDay = true;
    if (timeZone) item.timeZone = timeZone;
    if (first("STATUS"))
        item.status = first(
            "STATUS",
        )?.value.toLowerCase() as CalendarItem["status"];
    if (first("COMPLETED"))
        item.completedTime = parseDate(first("COMPLETED")?.value ?? "");
    if (first("PERCENT-COMPLETE"))
        item.percentComplete = Number(first("PERCENT-COMPLETE")?.value);
    if (first("SEQUENCE")) item.sequence = Number(first("SEQUENCE")?.value);
    const rule = first("RRULE")?.value;
    if (rule) {
        const parts = Object.fromEntries(
            rule.split(";").map((part) => {
                const [key, value] = part.split("=", 2);
                return [key, value];
            }),
        );
        if (parts.FREQ) {
            item.recurrence = {
                frequency:
                    parts.FREQ.toLowerCase() as RecurrenceInput["frequency"],
                ...(parts.INTERVAL ? { interval: Number(parts.INTERVAL) } : {}),
                ...(parts.COUNT ? { count: Number(parts.COUNT) } : {}),
                ...(parts.UNTIL ? { until: parseDate(parts.UNTIL) } : {}),
                ...(parts.BYDAY ? { byDay: parts.BYDAY.split(",") } : {}),
                ...(parts.BYMONTHDAY
                    ? { byMonthDay: parts.BYMONTHDAY.split(",").map(Number) }
                    : {}),
            };
        }
    }
    const parsePerson = ({
        params,
        value,
    }: {
        params: string;
        value: string;
    }): PersonInput => {
        const parameter = Object.fromEntries(
            params
                .split(";")
                .filter(Boolean)
                .map((part) => {
                    const [key, entry] = part.split("=", 2);
                    return [key.toUpperCase(), entry];
                }),
        );
        return {
            email: value.replace(/^mailto:/i, ""),
            ...(parameter.CN ? { name: unescapeText(parameter.CN) } : {}),
            ...(parameter.ROLE
                ? { role: parameter.ROLE.toLowerCase() as PersonInput["role"] }
                : {}),
            ...(parameter.PARTSTAT
                ? {
                      status: parameter.PARTSTAT.toLowerCase() as PersonInput["status"],
                  }
                : {}),
            ...(parameter.RSVP ? { rsvp: parameter.RSVP === "TRUE" } : {}),
        };
    };
    if (first("ORGANIZER"))
        item.organizer = parsePerson(
            first("ORGANIZER") as { params: string; value: string },
        );
    if (values.get("ATTENDEE")?.length)
        item.attendees = values.get("ATTENDEE")?.map(parsePerson);
    if (values.get("ATTACH")?.length)
        item.attachments = values.get("ATTACH")?.map(({ params, value }) => {
            const binary = /(?:^|;)VALUE=BINARY(?:;|$)/i.test(params);
            const mediaType = params.match(/(?:^|;)FMTTYPE=([^;]+)/i)?.[1];
            const filename = params.match(/(?:^|;)FILENAME=([^;]+)/i)?.[1];
            return {
                ...(binary ? { data: value } : { url: value }),
                ...(mediaType ? { mediaType } : {}),
                ...(filename ? { filename: unescapeText(filename) } : {}),
            };
        });
    if (alarmBlocks.length) {
        item.reminders = alarmBlocks.map((block) => {
            const entries = block.split(/\r?\n/);
            const value = (name: string) =>
                entries
                    .find((line) => line.toUpperCase().startsWith(`${name}:`))
                    ?.slice(name.length + 1);
            const action = value("ACTION")?.toLowerCase();
            const recipients = entries
                .filter((line) => line.toUpperCase().startsWith("ATTENDEE:"))
                .map((line) =>
                    line.slice("ATTENDEE:".length).replace(/^mailto:/i, ""),
                );
            return {
                trigger: value("TRIGGER") ?? "-PT15M",
                ...(action === "email"
                    ? { action: "email" as const }
                    : { action: "display" as const }),
                ...(value("DESCRIPTION")
                    ? { description: unescapeText(value("DESCRIPTION") ?? "") }
                    : {}),
                ...(recipients.length ? { recipients } : {}),
            };
        });
    }
    return item;
}
