import { AsyncLocalStorage } from "async_hooks";

export type InternalContext = {
  request: Request;
  params: Record<string, string>;
};

export const internalContext = new AsyncLocalStorage<InternalContext>();
