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
import { devManifestPlugin } from "./plugins/dev-manifest.js";
import { agentsMiddlewareInjector } from "./plugins/agents.js";

export type MiddlewareArgs = {
  request: Request;
  next: () => Promise<Response>;
};

export type Context = {
  componentRoutes: RouteManifest | undefined;
  apiRoutes: ApiRoute[] | undefined;
  clientManifest: Manifest | undefined;
};

const ctx: Context = {
  componentRoutes: undefined,
  apiRoutes: [],
  clientManifest: undefined,
};

export type PluginConfig = {
  cloudflare?: Parameters<typeof cloudflare>[0];
  /**
   * Glob patterns for API routes.
   * @default ["api*.{ts,js}"]
   */
  apiRoutePatterns?: string[];
};

export default function ({
  apiRoutePatterns = ["api*.{ts,js}"],
  cloudflare: cloudflareCfg,
}: PluginConfig = {}): Plugin[] {
  return [
    cloudflare(
      cloudflareCfg ?? { viteEnvironment: { name: "ssr" } },
    ) as unknown as Plugin,
    {
      name: "orange:settings",
      // @ts-ignore - this is a magic property used for the orange CLI
      orangeOptions: {
        apiRoutePatterns,
        cloudflare: cloudflareCfg,
      },
    },
    {
      name: "orange:route-plugin",
      enforce: "pre",
      async config(userConfig, env) {
        globalThis.__reactRouterAppDirectory = "app";
        const routes = await flatRoutes();
        const { manifest, apiRoutes } = loadRoutes(routes, apiRoutePatterns);
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
    serverBuilder(ctx),
    workerStub(),
    durableObjectRoutes(ctx),
    entrypoints(ctx),
    serverBundle(ctx),
    removeDataStubs(ctx),
    routeReload(),
    devManifestPlugin(ctx),
    agentsMiddlewareInjector(ctx),
    ...internal(),
    ...isolation(),
    ...hmr(),
  ];
}
