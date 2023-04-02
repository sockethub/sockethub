import { writable } from "svelte/store";
import type { BaseStore } from "./BaseStore";

export type ActorData = {
  state?: {
    actorSet: boolean;
    credentialsSet?: boolean;
    connected?: boolean;
    joined?: boolean;
  };
  object: {
    id: string;
    type: string;
    name: string;
  };
  roomId?: string;
};

const stores: Record<string, BaseStore<ActorData>> = {};
export function getActorStore(name: string, actor: ActorData) {
  if (!name) throw new Error("unique name must be provided");
  if (stores[name]) return stores[name];
  const { subscribe, set } = writable(actor as ActorData);
  stores[name] = {
    subscribe,
    set: (data: ActorData) => {
      set(data);
    },
  } as BaseStore<ActorData>;
  return stores[name];
}
