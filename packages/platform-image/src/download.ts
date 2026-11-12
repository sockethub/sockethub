/**
 * Helpers for the `download` verb: config, a byte-capped body reader and
 * image type detection from the bytes themselves.
 */

/** Image types the `download` verb can return, keyed by the name used in config. */
export const DOWNLOAD_IMAGE_TYPES = {
    avif: "image/avif",
    gif: "image/gif",
    ico: "image/x-icon",
    jpeg: "image/jpeg",
    png: "image/png",
    svg: "image/svg+xml",
    webp: "image/webp",
} as const;

export type DownloadImageType = keyof typeof DOWNLOAD_IMAGE_TYPES;

export interface DownloadConfig {
    maxBytes: number;
    timeoutMs: number;
    types: ReadonlySet<DownloadImageType>;
}

/** Upper bound for `maxBytes`; the config schema enforces the same maximum. */
export const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
/**
 * Under HTTP actions' default idleTimeoutMs (15 s): a download writes no
 * result line until it finishes, so a longer one would be cut off there.
 */
const DEFAULT_TIMEOUT_MS = 12_000;
/**
 * Jobs this platform runs at once across all clients. Peak memory is roughly
 * concurrency × maxBytes × 2.5 (bytes, base64, JSON).
 */
export const DEFAULT_DOWNLOAD_CONCURRENCY = 3;

/** Read the platform's packageConfig, falling back to defaults for unset keys. */
export function resolveDownloadConfig(raw: unknown): DownloadConfig {
    const config =
        raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const maxBytes =
        typeof config.maxBytes === "number" && config.maxBytes > 0
            ? Math.min(Math.floor(config.maxBytes), MAX_DOWNLOAD_BYTES)
            : DEFAULT_MAX_BYTES;
    const allTypes = Object.keys(DOWNLOAD_IMAGE_TYPES) as DownloadImageType[];
    const types = Array.isArray(config.types)
        ? allTypes.filter((type) => (config.types as unknown[]).includes(type))
        : allTypes;
    const timeoutMs =
        typeof config.timeoutMs === "number" && config.timeoutMs > 0
            ? Math.floor(config.timeoutMs)
            : DEFAULT_TIMEOUT_MS;
    return {
        maxBytes,
        timeoutMs,
        types: new Set(types),
    };
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
    return signature.every((byte, i) => bytes[offset + i] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
    return String.fromCharCode(...bytes.subarray(start, end));
}

/** AVIF is an ISO-BMFF `ftyp` box whose major or a compatible brand is avif/avis. */
function isAvif(bytes: Uint8Array): boolean {
    if (bytes.length < 16 || ascii(bytes, 4, 8) !== "ftyp") return false;
    const boxSize =
        ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>>
        0;
    const end = Math.min(boxSize, bytes.length);
    for (let offset = 8; offset + 4 <= end; offset += 4) {
        // offset 12 is the minor version, not a brand.
        if (offset === 12) continue;
        const brand = ascii(bytes, offset, offset + 4);
        if (brand === "avif" || brand === "avis") return true;
    }
    return false;
}

/**
 * SVG is text: skip an XML declaration, comments and a doctype, then expect
 * an `<svg` root. A linear scan, because a regex over the repeated prologue
 * parts can backtrack exponentially.
 */
function isSvg(bytes: Uint8Array): boolean {
    let text = new TextDecoder("utf-8")
        .decode(bytes.subarray(0, 4096))
        .replace(/^\uFEFF/, "");
    const skippable: Array<[string, string]> = [
        ["<?xml", "?>"],
        ["<!--", "-->"],
        ["<!doctype", ">"],
    ];
    for (;;) {
        text = text.trimStart();
        const lower = text.slice(0, 9).toLowerCase();
        const part = skippable.find(([open]) => lower.startsWith(open));
        if (!part) break;
        const end = text.indexOf(part[1], part[0].length);
        if (end === -1) return false;
        text = text.slice(end + part[1].length);
    }
    return /^<svg[\s>/]/i.test(text);
}

/**
 * Identify an image from its leading bytes. The `Content-Type` header is not
 * trusted: origins mislabel images, and block pages arrive as 200s.
 */
export function sniffImageType(
    bytes: Uint8Array,
): DownloadImageType | undefined {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return "png";
    }
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
    const head = ascii(bytes, 0, Math.min(bytes.length, 12));
    if (head.startsWith("GIF87a") || head.startsWith("GIF89a")) return "gif";
    if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return "webp";
    if (isAvif(bytes)) return "avif";
    if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00]) && bytes.length >= 6) {
        return "ico";
    }
    if (isSvg(bytes)) return "svg";
    return undefined;
}

/** Thrown by {@link readCapped} when the body exceeds the byte limit. */
export class TooLargeError extends Error {}

/**
 * Read a response body into memory, aborting as soon as it exceeds
 * `maxBytes` instead of buffering the whole response first.
 */
export async function readCapped(
    body: ReadableStream<Uint8Array> | null,
    maxBytes: number,
): Promise<Uint8Array> {
    if (!body) return new Uint8Array(0);
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new TooLargeError(`image is larger than ${maxBytes} bytes`);
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}
