import type { Manifest, Plugin } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { ApiRoute, loadRoutes, type RouteManifest } from "./routes.js";
import { durableObjectRoutes } from "./plugins/durable-objects.js";
import { workerStub } from "./plugins/worker-stub.js";
import { clientBuilder, serverBuilder } from "./plugins/build.js";
import { serverBundle } from "./plugins/server-bundle.js";
import { hmr } from "./plugins/hmr.js";
import { flatRoutes } from "@react-router/fs-routes";
import { isolation } from "./plugins/isolation.js";
import { removeDataStubs } from "./plugins/remove-data-stubs.js";
import { entrypoints } from "./plugins/entrypoints.js";
import { internal } from "./plugins/internal.js";
import { routeReload } from "./plugins/route-reload.js";

export type MiddlewareArgs = {
  request: Request;
  next: () => Promise<Response>;
};

export type Context = {
  componentRoutes: RouteManifest | undefined;
  apiRoutes: ApiRoute[] | undefined;
  clientManifest: Manifest | undefined;
};

const ctx: Context = { componentRoutes: undefined, apiRoutes: [], clientManifest: undefined };

export type PluginConfig = {
  cloudflare?: Parameters<typeof cloudflare>[0];
};

export default function ({
  cloudflare: cloudflareCfg,
}: PluginConfig = {}): Plugin[] {
  return [
    cloudflare(cloudflareCfg) as unknown as Plugin,
    {
      name: "orange:route-plugin",
      enforce: "pre",
      async config(userConfig, env) {
        globalThis.__reactRouterAppDirectory = "app";
        const routes = await flatRoutes();
        const { manifest, apiRoutes } = loadRoutes(routes);
        ctx.componentRoutes = manifest;
        ctx.apiRoutes = apiRoutes;

        if (env.mode === "production") {
          return;
        }

        return {
          ...userConfig,
          build: {
            ...userConfig.build,
            rollupOptions: {
              ...userConfig.build?.rollupOptions,
              external: ["cloudflare:workers"],
            },
          },
          optimizeDeps: {
            ...userConfig.optimizeDeps,
            exclude: [
              "cloudflare:workers",
              "cloudflare:env",
              ...(userConfig.optimizeDeps?.exclude ?? []),
            ],
          },
        };
      },
    },
    clientBuilder(ctx),
    serverBuilder(),
    workerStub(),
    durableObjectRoutes(ctx),
    entrypoints(ctx),
    serverBundle(ctx),
    removeDataStubs(ctx),
    routeReload(),
    ...internal(),
    ...isolation(),
    ...hmr(),
  ];
}
