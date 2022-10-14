// import "@sockethub/client/dist/sockethub-client.js"
import { io } from 'socket.io-client';
import SockethubClient from "@sockethub/client";
// import type SockethubClient from "@sockethub/client";

export const ssr = false;
export let sc: SockethubClient;
export let connected = false;

function stateChange(state: string) {
  return (e?: any) => {
    connected = state === 'connect';
  }
}

// eslint-disable-next-line no-constant-condition
if (typeof window === 'object') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  sc = new SockethubClient(io('http://localhost:10550', { path: '/sockethub' }));
  sc.socket.on('connect', stateChange('connect'));
  sc.socket.on('error', stateChange('error'));
  sc.socket.on('disconnect', stateChange('disconnect'));
}
