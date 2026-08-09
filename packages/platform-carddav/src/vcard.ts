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
        .replaceAll("\\", "\\\\")
        .replaceAll("\n", "\\n")
        .replaceAll(";", "\\;")
        .replaceAll(",", "\\,");

function contentLine(line: string) {
    let separator = -1;
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        if (line[index] === '"') quoted = !quoted;
        if (line[index] === ":" && !quoted) {
            separator = index;
            break;
        }
    }
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

export function parseVCard(body: string, id: string, etag?: string): Contact {
    const lines = unfold(body).filter(
        (line, index, all) =>
            line.length > 0 || (index > 0 && index < all.length - 1),
    );
    if (lines[0]?.toUpperCase() !== "BEGIN:VCARD")
        throw new Error("not a vCard");
    if (lines.at(-1)?.toUpperCase() !== "END:VCARD")
        throw new Error("unterminated vCard");
    const contact: Partial<Contact> & { type: "person" } = { type: "person" };
    const preserved: PreservedVCardProperty[] = [];
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
                const parts = splitEscaped(line.value, ";").map(unescapeText);
                [contact.familyName, contact.givenName] = parts;
                if (parts[2])
                    contact.additionalNames = splitEscaped(parts[2], ",");
                if (parts[3])
                    contact.honorificPrefixes = splitEscaped(parts[3], ",");
                if (parts[4])
                    contact.honorificSuffixes = splitEscaped(parts[4], ",");
                break;
            }
            case "NICKNAME":
                contact.nickname = unescapeText(line.value);
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
    return result;
}

function params(value: ContactValue | ContactAddress): string {
    const result: string[] = [];
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
        chunks.push(rest.slice(0, end));
        rest = rest.slice(end);
    }
    chunks.push(rest);
    return chunks.join("\r\n ");
}

export function buildVCard(
    input: ContactInput,
    preserved: PreservedVCardProperty[] = input.preservedProperties ?? [],
): { uid: string; body: string } {
    const uid = input.uid ?? crypto.randomUUID();
    if (/[\r\n/%\\]/.test(uid)) throw new Error("unsafe vCard UID");
    const n = [
        input.familyName,
        input.givenName,
        input.additionalNames?.join(","),
        input.honorificPrefixes?.join(","),
        input.honorificSuffixes?.join(","),
    ].map((value) => escapeText(value ?? ""));
    const lines = [
        "BEGIN:VCARD",
        "VERSION:4.0",
        `PRODID:-//Sockethub//CardDAV//EN`,
        `UID:${escapeText(uid)}`,
        `FN:${escapeText(input.name)}`,
        `N:${n.join(";")}`,
    ];
    if (input.nickname) lines.push(`NICKNAME:${escapeText(input.nickname)}`);
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
    if (input.organization) lines.push(`ORG:${escapeText(input.organization)}`);
    if (input.title) lines.push(`TITLE:${escapeText(input.title)}`);
    if (input.role) lines.push(`ROLE:${escapeText(input.role)}`);
    for (const url of input.urls ?? [])
        lines.push(`URL${params(url)}:${url.value}`);
    for (const photo of input.photoUrls ?? [])
        lines.push(`PHOTO;VALUE=uri:${photo}`);
    if (input.note) lines.push(`NOTE:${escapeText(input.note)}`);
    if (input.birthday) lines.push(`BDAY:${input.birthday}`);
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
