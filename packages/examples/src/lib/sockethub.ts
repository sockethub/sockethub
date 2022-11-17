import { io } from 'socket.io-client';
import SockethubClient from "@sockethub/client";
import { writable } from "svelte/store";

export let sc: SockethubClient;
export const connected = writable(false);

function stateChange(state: string) {
  return (e?: never) => {
    const c = state === 'connect';
    connected.update(() => {
      return c;
    });
    console.log(`sockethub ${state} [connected: ${c}]`, e ? e : '');
  }
}

// eslint-disable-next-line no-constant-condition
if (typeof window === 'object') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  console.log('connecting to sockethub');
  sc = new SockethubClient(io('http://localhost:10550', { path: '/sockethub' }));
  sc.socket.on('connect', stateChange('connect'));
  sc.socket.on('error', stateChange('error'));
  sc.socket.on('disconnect', stateChange('disconnect'));
}
