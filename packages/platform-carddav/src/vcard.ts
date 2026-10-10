import type {
    Contact,
    ContactAddress,
    ContactInput,
    ContactValue,
    PreservedVCardProperty,
} from "./types.js";

const KNOWN = new Set([
    "VERSION",
    "UID",
    "FN",
    "N",
    "NICKNAME",
    "EMAIL",
    "TEL",
    "ADR",
    "ORG",
    "TITLE",
    "ROLE",
    "URL",
    "PHOTO",
    "NOTE",
    "BDAY",
    "PRODID",
]);

function unfold(body: string): string[] {
    const lines = body
        .replaceAll("\r\n", "\n")
        .replaceAll("\r", "\n")
        .split("\n");
    const unfolded: string[] = [];
    for (const line of lines) {
        if (/^[ \t]/.test(line) && unfolded.length)
            unfolded[unfolded.length - 1] += line.slice(1);
        else unfolded.push(line);
    }
    return unfolded;
}

function splitEscaped(value: string, separator: string): string[] {
    const result: string[] = [];
    let current = "";
    let escaped = false;
    for (const character of value) {
        if (!escaped && character === separator) {
            result.push(current);
            current = "";
        } else {
            current += character;
            escaped = !escaped && character === "\\";
            if (character !== "\\") escaped = false;
        }
    }
    result.push(current);
    return result;
}

const unescapeText = (value: string) =>
    value
        .replace(/\\n/gi, "\n")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\");
const escapeText = (value: string) =>
    value
        .replace(/\r\n?/g, "\n")
        .replaceAll("\\", "\\\\")
        .replaceAll("\n", "\\n")
        .replaceAll(";", "\\;")
        .replaceAll(",", "\\,");

function valueSeparator(line: string): number {
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        if (line[index] === '"') quoted = !quoted;
        if (line[index] === ":" && !quoted) return index;
    }
    return -1;
}

function contentLine(line: string) {
    const separator = valueSeparator(line);
    if (separator < 1) throw new Error("invalid vCard content line");
    const head = line.slice(0, separator);
    const value = line.slice(separator + 1);
    const segments = head.split(";");
    const name =
        (segments.shift() ?? "").split(".").at(-1)?.toUpperCase() ?? "";
    const parameters = new Map<string, string[]>();
    for (const segment of segments) {
        const equals = segment.indexOf("=");
        if (equals < 0) {
            parameters.set("TYPE", [
                ...(parameters.get("TYPE") ?? []),
                segment.toLowerCase(),
            ]);
            continue;
        }
        const key = segment.slice(0, equals).toUpperCase();
        const values = segment
            .slice(equals + 1)
            .replace(/^"|"$/g, "")
            .split(",")
            .map((item) => item.toLowerCase());
        parameters.set(key, values);
    }
    return { name, parameters, value };
}

function typedValue(
    value: string,
    parameters: Map<string, string[]>,
): ContactValue {
    const types = parameters.get("TYPE")?.filter((type) => type !== "pref");
    const preference = parameters.get("PREF")?.[0];
    return {
        value: unescapeText(value.replace(/^mailto:/i, "")),
        ...(types?.length ? { types } : {}),
        ...(preference === "1" || parameters.get("TYPE")?.includes("pref")
            ? { preferred: true }
            : {}),
    };
}

/**
 * Lines whose structured value loses information the client did not edit.
 * Kept off the contact so a query response cannot echo them back.
 */
const originalLines = new WeakMap<
    Contact,
    { organization?: string; nickname?: string; photoLines?: string[] }
>();

export function parseVCard(body: string, id: string, etag?: string): Contact {
    const all = unfold(body);
    let first = 0;
    let last = all.length - 1;
    while (first <= last && all[first].length === 0) first += 1;
    while (last >= first && all[last].length === 0) last -= 1;
    const lines = all.slice(first, last + 1);
    if (lines[0]?.toUpperCase() !== "BEGIN:VCARD")
        throw new Error("not a vCard");
    if (lines.at(-1)?.toUpperCase() !== "END:VCARD")
        throw new Error("unterminated vCard");
    const contact: Partial<Contact> & { type: "person" } = { type: "person" };
    const preserved: PreservedVCardProperty[] = [];
    const photoLines: string[] = [];
    let organizationLine: string | undefined;
    let nicknameLine: string | undefined;
    let version: "3.0" | "4.0" | undefined;
    for (const raw of lines.slice(1, -1)) {
        if (!raw) continue;
        const line = contentLine(raw);
        switch (line.name) {
            case "VERSION":
                if (line.value === "3.0" || line.value === "4.0")
                    version = line.value;
                else preserved.push({ raw });
                break;
            case "UID":
                contact.uid = unescapeText(line.value);
                break;
            case "FN":
                contact.name = unescapeText(line.value);
                break;
            case "N": {
                // Components are split on unescaped ";" and list items on
                // unescaped "," before unescaping, so "\," stays inside a value.
                const parts = splitEscaped(line.value, ";");
                const list = (part: string | undefined) =>
                    part ? splitEscaped(part, ",").map(unescapeText) : [];
                contact.familyName = unescapeText(parts[0] ?? "");
                contact.givenName = unescapeText(parts[1] ?? "");
                if (parts[2]) contact.additionalNames = list(parts[2]);
                if (parts[3]) contact.honorificPrefixes = list(parts[3]);
                if (parts[4]) contact.honorificSuffixes = list(parts[4]);
                break;
            }
            case "NICKNAME":
                contact.nickname = unescapeText(line.value);
                nicknameLine = raw;
                break;
            case "EMAIL":
                contact.emails = [
                    ...(contact.emails ?? []),
                    typedValue(line.value, line.parameters),
                ];
                break;
            case "TEL":
                contact.telephones = [
                    ...(contact.telephones ?? []),
                    typedValue(
                        line.value.replace(/^tel:/i, ""),
                        line.parameters,
                    ),
                ];
                break;
            case "ADR": {
                const parts = splitEscaped(line.value, ";").map(unescapeText);
                const typed = typedValue("", line.parameters);
                const address: ContactAddress = {
                    ...(typed.types ? { types: typed.types } : {}),
                    ...(typed.preferred ? { preferred: true } : {}),
                    postOfficeBox: parts[0] || undefined,
                    extendedAddress: parts[1] || undefined,
                    street: parts[2] || undefined,
                    locality: parts[3] || undefined,
                    region: parts[4] || undefined,
                    postalCode: parts[5] || undefined,
                    country: parts[6] || undefined,
                };
                contact.addresses = [...(contact.addresses ?? []), address];
                break;
            }
            case "ORG":
                contact.organization = unescapeText(
                    splitEscaped(line.value, ";")[0],
                );
                organizationLine = raw;
                break;
            case "TITLE":
                contact.title = unescapeText(line.value);
                break;
            case "ROLE":
                contact.role = unescapeText(line.value);
                break;
            case "URL":
                contact.urls = [
                    ...(contact.urls ?? []),
                    typedValue(line.value, line.parameters),
                ];
                break;
            case "PHOTO":
                if (
                    line.parameters.get("VALUE")?.includes("uri") ||
                    /^(?:https?):/i.test(line.value)
                ) {
                    contact.photoUrls = [
                        ...(contact.photoUrls ?? []),
                        line.value,
                    ];
                    photoLines.push(raw);
                } else preserved.push({ raw });
                break;
            case "NOTE":
                contact.note = unescapeText(line.value);
                break;
            case "BDAY":
                contact.birthday = line.value;
                break;
            case "PRODID":
                break;
            default:
                preserved.push({ raw });
        }
    }
    if (!version || !contact.uid || !contact.name)
        throw new Error("vCard requires VERSION, UID, and FN");
    const result: Contact = {
        ...contact,
        id,
        uid: contact.uid,
        name: contact.name,
        vcardVersion: version,
        updateSupported: true,
        ...(etag ? { etag } : {}),
    };
    if (preserved.length)
        Object.defineProperty(result, "preservedProperties", {
            value: preserved,
            enumerable: false,
        });
    if (organizationLine || nicknameLine || photoLines.length)
        originalLines.set(result, {
            ...(organizationLine ? { organization: organizationLine } : {}),
            ...(nicknameLine ? { nickname: nicknameLine } : {}),
            ...(photoLines.length ? { photoLines } : {}),
        });
    return result;
}

function assertRetained(line: string, name: string): string {
    if (/[\r\n]/.test(line) || contentLine(line).name !== name)
        throw new Error(`invalid vCard ${name}`);
    return line;
}

function replaceOrganizationName(line: string, name: string): string {
    const separator = valueSeparator(line);
    if (separator < 1) throw new Error("invalid vCard organization");
    const parts = splitEscaped(line.slice(separator + 1), ";");
    parts[0] = escapeText(name);
    return assertRetained(
        `${line.slice(0, separator)}:${parts.join(";")}`,
        "ORG",
    );
}

/**
 * An update rebuilds the card from the client object. Query results only
 * carry the first ORG component, a single nickname string, and URI photos,
 * so echoing those values used to delete departments, collapse nickname
 * lists, and drop inline photos. Replay the server's line when the client
 * sent the same parsed value back, and keep the rest of ORG when only the
 * organization name changed.
 */
export function prepareVCardUpdate(
    input: ContactInput,
    stored: Contact,
): {
    input: ContactInput;
    preserved: PreservedVCardProperty[];
    retainedLines?: { organization?: string; nickname?: string };
} {
    const record = originalLines.get(stored);
    const retainedLines: { organization?: string; nickname?: string } = {};
    if (record?.organization && input.organization !== undefined) {
        retainedLines.organization =
            input.organization === stored.organization
                ? assertRetained(record.organization, "ORG")
                : replaceOrganizationName(
                      record.organization,
                      input.organization,
                  );
    }
    if (
        record?.nickname &&
        input.nickname !== undefined &&
        input.nickname === stored.nickname
    )
        retainedLines.nickname = assertRetained(record.nickname, "NICKNAME");

    const storedPhotos = stored.photoUrls ?? [];
    const inputPhotos = input.photoUrls;
    const photoLines = record?.photoLines;
    const preserved = stored.preservedProperties ?? [];
    const echoedPhotos =
        photoLines !== undefined &&
        inputPhotos !== undefined &&
        photoLines.length > 0 &&
        photoLines.length === storedPhotos.length &&
        inputPhotos.length === storedPhotos.length &&
        inputPhotos.every((url, index) => url === storedPhotos[index]);
    return {
        input: echoedPhotos ? { ...input, photoUrls: undefined } : input,
        preserved:
            echoedPhotos && photoLines
                ? [...preserved, ...photoLines.map((raw) => ({ raw }))]
                : preserved,
        ...(retainedLines.organization || retainedLines.nickname
            ? { retainedLines }
            : {}),
    };
}

function params(value: ContactValue | ContactAddress): string {
    const result: string[] = [];
    if (value.types?.some((type) => !/^[A-Za-z0-9-]+$/.test(type)))
        throw new Error("invalid vCard type parameter");
    if (value.types?.length)
        result.push(
            `TYPE=${value.types.map((type) => type.toLowerCase()).join(",")}`,
        );
    if (value.preferred) result.push("PREF=1");
    return result.length ? `;${result.join(";")}` : "";
}

function fold(line: string): string {
    const chunks: string[] = [];
    let rest = line;
    while (Buffer.byteLength(rest, "utf8") > 75) {
        let end = Math.min(75, rest.length);
        while (Buffer.byteLength(rest.slice(0, end), "utf8") > 75) end -= 1;
        const preceding = rest.charCodeAt(end - 1);
        if (preceding >= 0xd800 && preceding <= 0xdbff) end -= 1;
        if (end <= 0) throw new Error("unable to fold vCard content line");
        chunks.push(rest.slice(0, end));
        rest = rest.slice(end);
    }
    chunks.push(rest);
    return chunks.join("\r\n ");
}

export function buildVCard(
    input: ContactInput,
    preserved: PreservedVCardProperty[] = [],
    retainedLines?: { organization?: string; nickname?: string },
): { uid: string; body: string } {
    const uid = input.uid ?? crypto.randomUUID();
    if (/[\r\n/%\\]/.test(uid)) throw new Error("unsafe vCard UID");
    const assertRawValue = (value: string, field: string) => {
        if (/[\r\n]/.test(value)) throw new Error(`invalid vCard ${field}`);
        return value;
    };
    // List components join escaped items with a bare ",", the list separator;
    // escaping after joining would turn the list into one comma-bearing value.
    const list = (values: string[] | undefined) =>
        (values ?? []).map(escapeText).join(",");
    const n = [
        escapeText(input.familyName ?? ""),
        escapeText(input.givenName ?? ""),
        list(input.additionalNames),
        list(input.honorificPrefixes),
        list(input.honorificSuffixes),
    ];
    const lines = [
        "BEGIN:VCARD",
        "VERSION:4.0",
        `PRODID:-//Sockethub//CardDAV//EN`,
        `UID:${escapeText(uid)}`,
        `FN:${escapeText(input.name)}`,
        `N:${n.join(";")}`,
    ];
    if (retainedLines?.nickname)
        lines.push(assertRetained(retainedLines.nickname, "NICKNAME"));
    else if (input.nickname)
        lines.push(`NICKNAME:${escapeText(input.nickname)}`);
    for (const email of input.emails ?? [])
        lines.push(`EMAIL${params(email)}:${escapeText(email.value)}`);
    for (const telephone of input.telephones ?? [])
        lines.push(`TEL${params(telephone)}:${escapeText(telephone.value)}`);
    for (const address of input.addresses ?? []) {
        const parts = [
            address.postOfficeBox,
            address.extendedAddress,
            address.street,
            address.locality,
            address.region,
            address.postalCode,
            address.country,
        ];
        lines.push(
            `ADR${params(address)}:${parts.map((value) => escapeText(value ?? "")).join(";")}`,
        );
    }
    if (retainedLines?.organization)
        lines.push(assertRetained(retainedLines.organization, "ORG"));
    else if (input.organization)
        lines.push(`ORG:${escapeText(input.organization)}`);
    if (input.title) lines.push(`TITLE:${escapeText(input.title)}`);
    if (input.role) lines.push(`ROLE:${escapeText(input.role)}`);
    for (const url of input.urls ?? [])
        lines.push(`URL${params(url)}:${assertRawValue(url.value, "URL")}`);
    for (const photo of input.photoUrls ?? [])
        lines.push(`PHOTO;VALUE=uri:${assertRawValue(photo, "photo URL")}`);
    if (input.note) lines.push(`NOTE:${escapeText(input.note)}`);
    if (input.birthday)
        lines.push(`BDAY:${assertRawValue(input.birthday, "birthday")}`);
    const replacePhotos = input.photoUrls !== undefined;
    for (const property of preserved) {
        if (/[\r\n]/.test(property.raw))
            throw new Error("invalid preserved vCard property");
        const name = contentLine(property.raw).name;
        if (!KNOWN.has(name) || (name === "PHOTO" && !replacePhotos))
            lines.push(property.raw);
    }
    lines.push("END:VCARD");
    return { uid, body: `${lines.map(fold).join("\r\n")}\r\n` };
}
