import type { Writable } from "svelte/store";

export type Payload = {
    detail: {
        jsonString: string;
    };
};

export type TextAreaObject = {
    password?: string;
    id?: string;
    type?: string;
    name?: string;
};

type SockethubStateData = {
    actorSet: boolean;
    credentialsSet?: boolean;
    connected?: boolean;
    joined?: boolean;
};

export type SockethubStateStore = {
    set: Writable<SockethubStateData>["set"];
    subscribe: Writable<SockethubStateData>["subscribe"];
};
