import { io } from "socket.io-client";
import SockethubClient from "@sockethub/client";
import { writable } from "svelte/store";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { addObject, ObjectType } from "$components/logs/Logger.svelte";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { displayMessage } from "$components/chat/IncomingMessages.svelte";

export let sc: SockethubClient;
export const connected = writable(false);

const defaultConfig = {
  sockethub: {
    port: 10550,
    host: "localhost",
    path: "/sockethub"
  },
  public: {
    protocol: "http",
    host: "localhost",
    port: 10550,
    path: "/"
  }
};

export interface AnyActivityStream {
  id?: string;
  context: string;
  type: string;
  actor?: never;
  object?: never;
  target?: never;
  error?: string;
}

export async function send(obj: AnyActivityStream) {
  console.log("sending to sockethub: ", obj);
  return new Promise((resolve, reject) => {
    sc.socket.emit("message", addObject(ObjectType.send, obj), (resp: AnyActivityStream) => {
      console.log("response from sockethub: ", resp);
      addObject(ObjectType.resp, resp, resp.id);
      displayMessage(resp);
      if (resp.error) {
        reject(resp);
      } else {
        resolve(resp);
      }
    });
  });
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
  displayMessage(msg);
}

function sockethubConnect(config: typeof defaultConfig = defaultConfig) {
  sc = new SockethubClient(io(`${config.public.protocol}://${config.public.host}:${config.public.port}`, { path: config.sockethub.path }));
  sc.socket.on("connect", stateChange("connect"));
  sc.socket.on("error", stateChange("error"));
  sc.socket.on("disconnect", stateChange("disconnect"));
  sc.socket.on("message", handleIncomingMessage);
}

// eslint-disable-next-line no-constant-condition
if (typeof window === "object") {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  console.log("connecting to sockethub");
  fetch("/config.json").then(async (res) => {
    const config = await res.json();
    sockethubConnect(config);
  }).catch(() => {
    sockethubConnect();
  });
}
