import { AsyncLocalStorage } from "node:async_hooks";

export type RequestStore = {
  requestId: string;
  route: string;
  method: string;
  ip: string;
};

const storage = new AsyncLocalStorage<RequestStore>();

export function runWithContext<T>(store: RequestStore, fn: () => Promise<T>): Promise<T> {
  return storage.run(store, fn);
}

export function getContext(): RequestStore | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
