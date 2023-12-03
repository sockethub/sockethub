import { writable } from "svelte/store";
import type { BaseStore } from "./BaseStore";

export type CredentialsObjectData = {
  type: "credentials";
  userAddress?: string;
  nick: string;
  server: string;
  port?: number;
  secure: boolean;
  password?: string;
}
export type CredentialData = {
  isSet: boolean;
  object: CredentialsObjectData;
};

export function getCredentialsStore(creds: CredentialData) {
  const { subscribe, set } = writable(creds as CredentialData);
  return {
    subscribe,
    set,
  } as BaseStore<CredentialData>;
}
