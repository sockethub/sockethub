// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { displayMessage } from "$components/chat/IncomingMessages.svelte";
import { addObject, addSchemaEvent } from "$components/logs/Logger.svelte";
import { platformIdFromContext } from "@sockethub/schemas/context";
import SockethubClient from "@sockethub/client";
import { io } from "socket.io-client";
import { writable } from "svelte/store";
import {
    defaultConfig,
    loadExamplesConfig,
    type ExamplesConfig,
} from "./examples-config";

export let sc: SockethubClient;
export const connected = writable(false);

type BaseProps = {
    id?: string;
    name?: string;
    type: string;
    content?: string;
    url?: string;
    contentType?: string;
    title?: string;
    published?: string;
};

/** Wait until the server schema registry is loaded (required for contextFor). */
export async function ensureClientReady(): Promise<void> {
    if (!sc) {
        throw new Error("Sockethub client is not initialized yet");
    }
    await sc.ready();
}

/** Build canonical @context from the server registry (not hardcoded URLs). */
export async function contextFor(platform: string): Promise<string[]> {
    await ensureClientReady();
    return sc.contextFor(platform) as string[];
}

export { platformIdFromContext };

export interface AnyActivityStream {
    id?: string;
    "@context": string[];
    type: string;
    totalItems?: number;
    summary?: string;
    items?: AnyActivityStream[];
    actor?: BaseProps | string;
    object?: BaseProps;
    target?: BaseProps | string;
    error?: string;
}

export type ActorData = {
    id: string;
    name: string;
    type: string;
};

/** ActivityStreams actor object for credentials and message events. */
export function actorAsObject(actor: ActorData): ActorData {
    return {
        id: actor.id,
        type: actor.type,
        name: actor.name ?? actor.id,
    };
}

export type CredentialsObjectData = IrcCredentials | XmppCredentials;

export type CredentialName = "credentials";

export type IrcCredentials = {
    type: CredentialName;
    nick: string;
    server: string;
    port: number;
    secure: boolean;
    password?: string;
};

type XmppCredentialsBase = {
    type: "credentials";
    resource: string;
    userAddress: string;
};

export type XmppCredentials = XmppCredentialsBase & { password: string };

export type CredentialData = {
    isSet: boolean;
    object: CredentialsObjectData;
};

export type SockethubResponse = {
    error: string;
};

export async function send(obj: AnyActivityStream) {
    await ensureClientReady();
    console.log("sending ->", obj);

    return new Promise<AnyActivityStream>((resolve, reject) => {
        const request = addObject("SEND", obj);
        sc.socket.emit("message", request, (resp: AnyActivityStream) => {
            console.log("received <-", resp);
            addObject("RESP", resp);
            if (resp.totalItems && resp.items) {
                for (const item of resp.items.reverse()) {
                    addObject("RESP", item, true, request.id);
                }
            }
            displayMessage(resp, true);
            if (resp.error) {
                reject(resp.error);
            } else {
                resolve(resp);
            }
        });
    });
}

function stateChange(state: string) {
    return (e?: unknown) => {
        const c = state === "connect";
        connected.update(() => {
            return c;
        });
        console.log(`sockethub ${state} [connected: ${c}]`, e ? e : "");
    };
}

function handleIncomingMessage(msg: AnyActivityStream) {
    console.log("handle incoming: ", msg);
    displayMessage(msg, false);
}

function sockethubConnect(config: ExamplesConfig = defaultConfig) {
    sc = new SockethubClient(
        io(
            `${config.public.protocol}://${config.public.host}:${config.public.port}`,
            {
                path: config.sockethub.path,
            },
        ),
        { initTimeoutMs: 10000 },
    );
    sc.socket.on("connect", stateChange("connect"));
    sc.socket.on("error", stateChange("error"));
    sc.socket.on("disconnect", stateChange("disconnect"));
    sc.socket.on("message", handleIncomingMessage);
    sc.socket.on("schemas", (payload: unknown) => {
        console.log("schemas received:", payload);
        addSchemaEvent("schemas", payload);
    });
    sc.socket.on("ready", (info: unknown) => {
        console.log("client ready:", info);
        addSchemaEvent("ready", info);
    });
    sc.socket.on("init_error", (err: unknown) => {
        console.error("client init error:", err);
        addSchemaEvent("init_error", err);
    });
}

if (typeof globalThis === "object" && "window" in globalThis) {
    console.log("connecting to sockethub");
    loadExamplesConfig()
        .then(sockethubConnect)
        .catch(() => sockethubConnect());
}
