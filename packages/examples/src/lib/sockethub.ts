import "@sockethub/client/dist/sockethub-client.js"
import { io, Socket } from 'socket.io-client';
import { createEventDispatcher } from "svelte";

export const ssr = false;
export let sc: {socket: Socket};
export let connected = false;

function stateChange(state: string) {
  return (e?: any) => {
    connected = state === 'connect';
    // dispatch("change", {
    //   connected: connected,
    //   sc: sc,
    //   err: e
    // });
  }
}

// eslint-disable-next-line no-constant-condition
if (typeof window === 'object') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  sc = new window.SockethubClient(io('http://localhost:10550', { path: '/sockethub' }));
  sc.socket.on('connect', stateChange('connect'));
  sc.socket.on('error', stateChange('error'));
  sc.socket.on('disconnect', stateChange('disconnect'));
}
