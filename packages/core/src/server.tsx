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

export function app(serverBuild: ServerBuild) {
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

  const fetch = async (request: Request, env: unknown, ctx: unknown) => {
    return await _env.run(env, async () => {
      const requestContext = { cloudflare: { env, ctx } };
      if (request.headers.get("upgrade") === "websocket") {
        return await queryRoute(request, { requestContext });
      }

      return await handler(request, requestContext);
    });
  };

  const app = new Hono();

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

  return app;
}

function wrapLoadersAndActions(build: ServerBuild) {
  for (const route of Object.values(build.routes)) {
    if (route === undefined) {
      continue;
    }

    const module = { ...route.module };
    const { loader, action } = module;

    if (loader) {
      // @ts-ignore
      module.loader = (opts: object) => loader({ ...opts, env: _env.getStore() });
    }

    if (action) {
      // @ts-ignore
      module.action = (opts: object) => action({ ...opts, env: _env.getStore() });
    }

    route.module = module;
  }
}
