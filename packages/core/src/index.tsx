import * as React from "react";

export { useWebsocket } from "./websocket.js";
export {
  RouteDurableObject,
  useDurableObject,
  actionIn,
  loaderIn,
} from "./durable-object.js";
export type * from "./durable-object.js";

export * from "react-router";

// @ts-ignore
export type CloudflareEnv = Env;

import type * as rr from "react-router";

export type ActionFunctionArgs = rr.ActionFunctionArgs<{
  cloudflare: { env: CloudflareEnv };
}> & { env: CloudflareEnv };

export type LoaderFunctionArgs = rr.LoaderFunctionArgs<{
  cloudflare: { env: CloudflareEnv };
}> & { env: CloudflareEnv };

export function unstable_shouldClone(t: any) {
  if (t instanceof Response) {
    return false;
  }

  if (Object.getPrototypeOf(t) === Object.prototype) {
    return false;
  }

  return true;
}
