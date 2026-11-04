import { afterAll, describe, expect, it } from "bun:test";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
    type ActivityStream,
    addPlatformContext,
    addPlatformSchema,
    type CredentialsObject,
    validateActivityStream,
    validateCredentials,
} from "@sockethub/schemas";
import { Server } from "socket.io";
import Instagram, {
    type InstagramCredentials,
} from "../packages/platform-instagram/src/index";
import { PlatformInstagramSchema } from "../packages/platform-instagram/src/schema";
import Messenger, {
    type MessengerCredentials,
} from "../packages/platform-messenger/src/index";
import { PlatformMessengerSchema } from "../packages/platform-messenger/src/schema";

const giggerRoot = process.env.GIGGER_ROOT;
if (!giggerRoot)
    throw new Error(
        "Set GIGGER_ROOT to the Gigger checkout to test its actual adapter.",
    );
const { sockethubSender } = await import(
    pathToFileURL(resolve(giggerRoot, "api/src/sender.ts")).href
);
const schemas = [PlatformMessengerSchema, PlatformInstagramSchema];
for (const schema of schemas) {
    addPlatformContext(schema.name, schema.contextUrl);
    addPlatformSchema(schema.credentials, `${schema.name}/credentials`);
    addPlatformSchema(schema.messages, `${schema.name}/messages`);
}
const originalFetch = globalThis.fetch;
const calls: { url: string; body: Record<string, unknown> }[] = [];
let windowClosed = false;
globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!/^https:\/\/graph\.(facebook|instagram)\.com\//.test(url)) {
        if (new URL(url).hostname !== "127.0.0.1")
            throw new Error(`Unexpected network request: ${url}`);
        return originalFetch(input, init);
    }
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    expect((init?.headers as Record<string, string>).authorization).toBe(
        "Bearer test-page-token",
    );
    return windowClosed
        ? Response.json(
              {
                  error: {
                      code: 10,
                      error_subcode: 2534022,
                      message: "Outside allowed window",
                  },
              },
              { status: 400 },
          )
        : Response.json({ message_id: "mid.contract" });
}) as typeof fetch;

const http = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(
        JSON.stringify({
            name: "sockethub",
            apiVersion: 1,
            endpoints: { socketIO: "/sockethub" },
            platforms: schemas.map((schema) => ({
                id: schema.name,
                apiVersion: 1,
            })),
        }),
    );
});
const io = new Server(http, { path: "/sockethub", transports: ["polling"] });
const session = {
    log: { debug() {}, info() {}, warn() {}, error() {} },
    sendToClient() {},
    async updateActor() {},
};
io.on("connection", (socket) => {
    const stored = new Map<string, CredentialsObject>();
    socket.on("schemas", (_fingerprint, ack) =>
        ack({
            apiVersion: 1,
            contexts: {
                as: "https://www.w3.org/ns/activitystreams",
                sockethub: "https://sockethub.org/ns/context/v1.jsonld",
            },
            platforms: schemas.map((schema) => ({
                id: schema.name,
                apiVersion: 1,
                contextUrl: schema.contextUrl,
                contextVersion: "1",
                schemaVersion: "1",
                types: ["send"],
                schemas: {
                    credentials: schema.credentials,
                    messages: schema.messages,
                },
            })),
        }),
    );
    socket.on("credentials", (activity: ActivityStream, ack) => {
        const error = validateCredentials(activity);
        if (error) return ack({ error });
        stored.set(activity.actor.id, activity as unknown as CredentialsObject);
        ack({});
    });
    socket.on("message", async (activity: ActivityStream, ack) => {
        const error = validateActivityStream(activity);
        if (error) return ack({ error });
        const credentials = stored.get(activity.actor.id);
        if (!credentials) return ack({ error: "Missing credentials" });
        const done = (failure?: string | Error) =>
            ack(failure ? { error: String(failure) } : {});
        if (activity["@context"].includes(PlatformInstagramSchema.contextUrl)) {
            await new Instagram(session).send(
                activity,
                credentials as InstagramCredentials,
                done,
            );
        } else {
            await new Messenger(session).send(
                activity,
                credentials as MessengerCredentials,
                done,
            );
        }
    });
});
await new Promise<void>((ready) => http.listen(0, "127.0.0.1", ready));
const address = http.address();
if (!address || typeof address === "string")
    throw new Error("Missing test server address");
const url = `http://127.0.0.1:${address.port}`;
afterAll(async () => {
    globalThis.fetch = originalFetch;
    await new Promise<void>((done) => io.close(() => done()));
});

describe("Gigger adapter → real Sockethub schemas → Meta request", () => {
    for (const platform of ["messenger", "instagram"] as const) {
        it(`sends ${platform} Page-token replies and propagates window errors`, async () => {
            const sender = sockethubSender(platform, url);
            const message = {
                id: "contract",
                channel: platform,
                direction: "out",
                conversation: "conversation",
                bandId: "band",
                actor: { id: platform === "instagram" ? "333" : "111" },
                target: { id: "222" },
                object: { type: "Note", content: "Hello" },
                published: "2026-01-01T00:00:00Z",
            };
            const credentials = {
                token: "test-page-token",
                apiVersion: "v26.0",
                ...(platform === "instagram"
                    ? { login: "facebook", pageId: "111" }
                    : {}),
            };
            for (const humanAgent of [false, true]) {
                await sender.send(
                    {
                        ...message,
                        ...(humanAgent ? { tag: "HUMAN_AGENT" } : {}),
                    },
                    credentials,
                );
                expect(calls.at(-1)).toEqual({
                    url: "https://graph.facebook.com/v26.0/111/messages",
                    body: {
                        recipient: { id: "222" },
                        message: { text: "Hello" },
                        messaging_type: humanAgent ? "MESSAGE_TAG" : "RESPONSE",
                        ...(humanAgent ? { tag: "HUMAN_AGENT" } : {}),
                    },
                });
            }
            windowClosed = true;
            try {
                await expect(sender.send(message, credentials)).rejects.toThrow(
                    "meta:messaging-window-closed",
                );
            } finally {
                windowClosed = false;
            }
        });
    }
});
