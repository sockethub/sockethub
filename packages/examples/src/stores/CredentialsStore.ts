import { writable } from "svelte/store";
import type { BaseStore } from "./BaseStore";

export type CredentialsObjectData = IrcCredentials | XmppCredentials;

export type IrcCredentials = {
  type: "credentials";
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

export function getCredentialsStore(creds: CredentialData) {
  const { subscribe, set } = writable(creds as CredentialData);
  return {
    subscribe,
    set,
  } as BaseStore<CredentialData>;
}
