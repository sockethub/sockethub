import type { Writable } from "svelte/store";

export type BaseStore<T> = {
  subscribe: Writable<T>["subscribe"];
  set(data: T): void;
};
