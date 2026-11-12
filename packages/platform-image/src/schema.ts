import packageJson from "../package.json" with { type: "json" };
import { DOWNLOAD_IMAGE_TYPES } from "./download";

export const PlatformImageSchema = {
    name: "image",
    version: packageJson.version,
    contextUrl: "https://sockethub.org/ns/context/platform/image/v1.jsonld",
    contextVersion: "1",
    schemaVersion: "1",
    messages: {
        required: ["type", "object"],
        properties: {
            type: { type: "string", enum: ["download"] },
            // `actor.id` is the page that references the image; `url` may be
            // relative to it.
            object: {
                type: "object",
                required: ["type", "url"],
                additionalProperties: false,
                properties: {
                    type: { const: "image" },
                    url: { type: "string", minLength: 1, maxLength: 8192 },
                },
            },
        },
    },
    // Outbound (platform -> client): the request with `object` replaced by
    // the image's bytes, base64-encoded in `data`. `url` is the final URL
    // after redirects; `mediaType` comes from the bytes.
    responses: {
        type: "object",
        required: ["type", "actor", "object"],
        additionalProperties: false,
        properties: {
            "@context": { type: "array", items: { type: "string" } },
            id: { type: "string" },
            type: { enum: ["download"] },
            actor: {
                type: "object",
                required: ["id", "type"],
                additionalProperties: false,
                properties: {
                    id: { type: "string" },
                    type: { enum: ["website"] },
                    name: { type: "string" },
                },
            },
            object: {
                type: "object",
                required: ["type", "url", "mediaType", "size", "data"],
                additionalProperties: false,
                properties: {
                    type: { const: "image" },
                    url: { type: "string" },
                    mediaType: { enum: Object.values(DOWNLOAD_IMAGE_TYPES) },
                    size: { type: "integer", minimum: 0 },
                    data: { type: "string" },
                },
            },
        },
    },
};
