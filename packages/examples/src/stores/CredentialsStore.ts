import { writable } from "svelte/store";
import type { BaseStore } from "./BaseStore";

export type CredentialData = {
  isSet: boolean;
  object: {
    type: "credentials";
    nick: string;
    server: string;
    port?: number;
    secure: boolean;
  };
};

export function getCredentialsStore(creds: CredentialData) {
  const { subscribe, set } = writable(creds as CredentialData);
  return {
    subscribe,
    set,
  } as BaseStore<CredentialData>;
}
