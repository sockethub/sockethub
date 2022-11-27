import { writable } from "svelte/store";
import type { BaseStore } from "./BaseStore";

export type ActorData = {
  isSet: boolean;
  object: {
    id: string;
    type: string;
    name: string;
  }
}

export function getActorStore(actor: ActorData) {
  const {subscribe, set} = writable(actor as ActorData);
  return {
    subscribe,
    set: (data: ActorData) => {
      set(data);
    }
  } as BaseStore<ActorData>;
}
