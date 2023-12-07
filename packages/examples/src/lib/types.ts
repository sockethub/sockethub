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

type StateData = {
  actorSet: boolean;
  credentialsSet?: boolean;
  connected?: boolean;
  joined?: boolean;
};

export type StateStore = {
  subscribe: Writable<StateData>["subscribe"];
};
