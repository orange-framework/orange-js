import { env } from "cloudflare:workers";
import {
  createRequestHandler,
  createStaticHandler,
  type ServerBuild as RRServerBuild,
  type RouteObject,
} from "react-router";

export interface ServerBuild extends RRServerBuild {
  apiRoutes: Record<
    string,
    {
      default: {
        fetch: (
          request: Request,
          env: unknown,
          ctx: ExecutionContext
        ) => Promise<Response>;
      };
    }
  >;
}

// @ts-ignore
import { _env } from "./internal.js";
import { Hono } from "hono";
import { CloudflareEnv, Context } from "./index.js";
import { createMiddleware } from "hono/factory";
import { AsyncLocalStorage } from "async_hooks";

const contextStorage = new AsyncLocalStorage<Context>();

function isProbablyHono(obj: object) {
  const honoKeys = [
    "routes",
    "_basePath",
    "route",
    "mount",
    "errorHandler",
    "all",
    "get",
    "post",
  ];

  return honoKeys.every((key) => key in obj);
}

export type AppOptions = {
  context?: (
    env: CloudflareEnv
  ) => Omit<Context, "cloudflare"> | Promise<Omit<Context, "cloudflare">>;
};

export function app(serverBuild: ServerBuild, options?: AppOptions) {
  const contextFn = options?.context ?? ((env) => ({}));
  // @ts-ignore
  globalThis.__orangeContextFn = contextFn;
  const globalMiddleware: Array<
    (
      request: Request,
      env: CloudflareEnv
    ) => Promise<Response | null | undefined>
    // @ts-ignore
  > = globalThis.middlewareStages ?? [];

  wrapLoadersAndActions(serverBuild);
  const handler = createRequestHandler(serverBuild);
  const routeObjects: RouteObject[] = Object.values(serverBuild.routes)
    .filter((it) => it !== undefined)
    .map((route) => ({
      id: route.id,
      path: route.path,
      index: route.index,
      loader: route.module.loader,
      caseSensitive: route.caseSensitive,
    }));

  // This is a big ol' hack, but I think it's okay
  const { queryRoute } = createStaticHandler(routeObjects);

  const fetch = async (request: Request, env: unknown) => {
    return await _env.run(env, async () => {
      const context = contextStorage.getStore();
      if (!context) {
        throw new Error("No context found for request");
      }

      if (request.headers.get("upgrade") === "websocket") {
        return await queryRoute(request, { requestContext: context });
      }

      // @ts-ignore
      return await handler(request, context);
    });
  };

  const app = new Hono();

  for (const middleware of globalMiddleware) {
    app.use(
      createMiddleware(async (c, next) => {
        const response = await middleware(c.req.raw, c.env);
        if (response !== null && response !== undefined) {
          return response;
        }

        return await next();
      })
    );
  }

  for (const [path, module] of Object.entries(serverBuild.apiRoutes)) {
    const { default: handler } = module;
    if (isProbablyHono(handler)) {
      // @ts-ignore
      app.route(`/${path}`, handler);
    } else {
      app.mount(`/${path}`, module.default.fetch, {
        // By default Hono rewrites the path for mounted handlers, but we want to keep the
        // route as-is for API handlers.
        replaceRequest: (req) => req,
      });
    }
  }

  app.mount("/", fetch);

  return {
    async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
      const baseContext = { cloudflare: { env, ctx } };
      const context = { ...baseContext, ...(await contextFn(env)) };
      return await contextStorage.run(context, () =>
        app.fetch(request, env, ctx)
      );
    },
  };
}

function wrapLoadersAndActions(build: ServerBuild) {
  for (const route of Object.values(build.routes)) {
    if (route === undefined) {
      continue;
    }

    const module = { ...route.module };
    const { loader, action } = module;

    if (loader) {
      module.loader = (opts: object) =>
        // @ts-ignore
        loader({ ...opts, env: _env.getStore() });
    }

    if (action) {
      module.action = (opts: object) =>
        // @ts-ignore
        action({ ...opts, env: _env.getStore() });
    }

    route.module = module;
  }
}

/**
 * Get the context for the current invocation.
 *
 * This function is useful for getting the context outside of a data loader or action.
 *
 * @returns The context for the current invocation.
 */
export async function context(): Promise<Context> {
  const contextInAls = contextStorage.getStore();
  if (!contextInAls) {
    // @ts-ignore
    return await globalThis.__orangeContextFn(env);
  }

  return contextInAls;
}
