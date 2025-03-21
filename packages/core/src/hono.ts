import { createMiddleware } from "hono/factory";
import { app, ServerBuild } from "./server.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { HonoBase } from "hono/hono-base";

const vars = new AsyncLocalStorage<any>();

export function handler(serverBuild: ServerBuild) {
  const orangeApp = app(serverBuild);

  return createMiddleware(async (c) => {
    return vars.run(c.var, () => {
      return orangeApp.fetch(
        c.req.raw,
        c.env,
        c.executionCtx as ExecutionContext
      );
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
