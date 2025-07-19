import { createMiddleware } from "hono/factory";
import { AsyncLocalStorage } from "node:async_hooks";
import { HonoBase } from "hono/hono-base";
import { PropsWithChildren } from "react";
import * as server from "./server.js";

const vars = new AsyncLocalStorage<any>();

export function handler(
  layout: (props: PropsWithChildren) => React.ReactNode,
  options?: server.AppOptions
) {
  const orangeApp = server.app(layout, options);

  return createMiddleware(async (c) => {
    return vars.run(c.var, () => {
      return orangeApp.fetch(c.req.raw);
    });
  });
}

type ExtractEnv<T> = T extends HonoBase<infer Env>
  ? Env extends { Variables: infer V }
    ? V
    : {}
  : never;

export function variables<
  App extends HonoBase<any, any, any>
>(): ExtractEnv<App> {
  const state = vars.getStore();
  if (!state) {
    throw new Error("Not within Hono context");
  }

  return state;
}
