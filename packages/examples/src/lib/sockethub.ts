// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { displayMessage } from "$components/chat/IncomingMessages.svelte";
import { addObject } from "$components/logs/Logger.svelte";
import SockethubClient from "@sockethub/client";
import { io } from "socket.io-client";
import { writable } from "svelte/store";

export let sc: SockethubClient;
export const connected = writable(false);

const defaultConfig = {
    sockethub: {
        port: 10550,
        host: "localhost",
        path: "/sockethub",
    },
    public: {
        protocol: "http",
        host: "localhost",
        port: 10550,
        path: "/",
    },
};

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

export interface AnyActivityStream {
    id?: string;
    context: string;
    type: string;
    totalItems?: number;
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

export type XmppCredentials = {
    type: "credentials";
    resource: string;
    userAddress: string;
    password: string;
};

export type CredentialData = {
    isSet: boolean;
    object: CredentialsObjectData;
};

export type SockethubResponse = {
    error: string;
};

export async function send(obj: AnyActivityStream) {
    console.log("sending ->", obj);
    sc.socket.emit(
        "message",
        addObject("SEND", obj),
        (resp: AnyActivityStream) => {
            if (resp.totalItems && resp.items) {
                for (const item of resp.items) {
                    addObject("RESP", item, resp.id);
                }
            } else {
                console.log("received <-", resp);
                addObject("RESP", resp, resp.id);
            }
            displayMessage(resp);
        },
    );
}

function stateChange(state: string) {
    return (e?: never) => {
        const c = state === "connect";
        connected.update(() => {
            return c;
        });
        console.log(`sockethub ${state} [connected: ${c}]`, e ? e : "");
    };
}

function handleIncomingMessage(msg: AnyActivityStream) {
    console.log("handle incoming: ", msg);
    displayMessage(msg);
}

function sockethubConnect(config: typeof defaultConfig = defaultConfig) {
    sc = new SockethubClient(
        io(
            `${config.public.protocol}://${config.public.host}:${config.public.port}`,
            {
                path: config.sockethub.path,
            },
        ),
    );
    sc.socket.on("connect", stateChange("connect"));
    sc.socket.on("error", stateChange("error"));
    sc.socket.on("disconnect", stateChange("disconnect"));
    sc.socket.on("message", handleIncomingMessage);
}

if (typeof window === "object") {
    console.log("connecting to sockethub");
    fetch("/config.json")
        .then(async (res) => {
            const config = await res.json();
            sockethubConnect(config);
        })
        .catch(() => {
            sockethubConnect();
        });
}
