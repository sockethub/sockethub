import { writable } from "svelte/store";
import type { BaseStore } from "./BaseStore";


type CredentialObject = {
  type: 'credentials';
  nick: string;
  server: string;
  port?: number;
  secure: boolean;
}

export function getCredentialsStore(creds: CredentialObject) {
  const {subscribe, set} = writable(creds as CredentialObject);
  return {
    subscribe,
    set
  } as BaseStore<CredentialObject>;
}
