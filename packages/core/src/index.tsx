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

export type ActionFunctionArgs = rr.ActionFunctionArgs<Context> & {
  env: CloudflareEnv;
};

export type LoaderFunctionArgs = rr.LoaderFunctionArgs<Context> & {
  env: CloudflareEnv;
};

export type ContextFrom<T extends () => {}> = Awaited<ReturnType<T>>;

export interface Context {
  cloudflare: {
    env: CloudflareEnv;
    ctx: ExecutionContext;
  };
}

export type ContextWithoutExecutionContext = Omit<Context, "cloudflare"> & {
  cloudflare: {
    env: CloudflareEnv;
  };
};
