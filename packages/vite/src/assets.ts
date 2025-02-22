import type { Manifest } from "vite";
import * as crypto from "node:crypto";
import type { Context } from "./index.js";
import type { RouteManifestEntry } from "./routes.js";
import { mapObject, unreachable } from "./util.js";
import { virtualInjectHmrRuntime } from "./plugins/hmr.js";
import { browserManifestVirtualModule } from "./plugins/dev-manifest.js";

export function releaseAssets(ctx: Context) {
  const routes = ctx.componentRoutes ?? unreachable();
  const manifest = ctx.clientManifest ?? unreachable();

  const assetRoutes = mapObject(routes, (route) =>
    mapManifestRoute(route, manifest),
  );

  const entryChunk =
    Object.values(manifest).find((it) => it.isEntry) ?? unreachable();
  const entry = {
    module: `/${entryChunk.file}`,
    imports: resolve(manifest, entryChunk.imports),
    css: resolve(manifest, entryChunk.css),
  };

  const version = crypto
    .createHash("sha256")
    .update(JSON.stringify({ entry, routes }))
    .digest("hex")
    .slice(0, 8);

  return {
    entry,
    routes: assetRoutes,
    url: `/assets/manifest-${version}.js`,
    version,
  };
}

function mapManifestRoute(route: RouteManifestEntry, manifest: Manifest) {
  const chunk = manifest[route.file];

  return {
    id: route.id,
    parentId: route.parentId,
    path: route.path,
    index: route.index ?? false,
    caseSensitive: true,
    hasLoader: route.hasLoader ?? false,
    hasAction: route.hasAction ?? false,
    hasClientLoader: route.hasClientLoader ?? false,
    hasClientAction: route.hasClientAction ?? false,
    hasErrorBoundary: route.hasErrorBoundary ?? false,
    module: `/${chunk.file}`,
    imports: resolve(manifest, chunk.imports),
    css: resolve(manifest, chunk.css),
  };
}

function resolve(manifest: Manifest, items: string[] | undefined): string[] {
  const unresolved = items ?? [];

  return unresolved.map((it) => {
    const chunk = manifest[it];
    if (!chunk) {
      // throw new Error(`Could not find chunk "${it}" in manifest`);
      return `/${it}`;
    }

    return `/${chunk.file}`;
  });
}

export function devAssets(ctx: Context) {
  const routes = ctx.componentRoutes ?? unreachable();
  const assetRoutes = mapObject(routes, (route) => ({
    id: route.id,
    parentId: route.parentId,
    path: route.path,
    index: route.index ?? false,
    caseSensitive: true,
    hasLoader: route.hasLoader ?? false,
    hasAction: route.hasAction ?? false,
    hasClientLoader: route.hasClientLoader ?? false,
    hasClientAction: route.hasClientAction ?? false,
    hasErrorBoundary: route.hasErrorBoundary ?? false,
    module: `/${route.file}`,
    imports: [],
  }));

  return {
    entry: {
      module: "/app/entry.client.ts",
      imports: [],
    },
    hmr: {
      runtime: virtualInjectHmrRuntime.url,
    },
    routes: assetRoutes,
    url: browserManifestVirtualModule.url,
    version: "dev",
  };
}
