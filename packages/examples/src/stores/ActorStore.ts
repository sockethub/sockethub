import { writable } from "svelte/store";
import type { BaseStore } from "./BaseStore";

export type ActorData = {
  state: {
    actorSet: boolean;
    credentialsSet: boolean,
    connected: boolean,
    joined: boolean,
  }
  object: {
    id: string;
    type: string;
    name: string;
  },
  roomId: string;
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
