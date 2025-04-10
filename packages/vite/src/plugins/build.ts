import { assert, unreachable } from "../util.js";
import type { Context } from "../index.js";
import type { Manifest, Plugin } from "vite";
import { releaseAssets } from "../assets.js";
import { writeFileSync } from "fs";

export function clientBuilder(ctx: Context): Plugin {
  return {
    name: "orange:client-builder",
    enforce: "pre",
    writeBundle(options, bundle) {
      const manifestChunk = bundle[".vite/manifest.json"];
      assert("source" in manifestChunk, "missing manifest chunk");
      const clientManifest: Manifest = JSON.parse(
        (manifestChunk?.source as string) ?? unreachable(),
      );

      ctx.clientManifest = clientManifest;

      const manifest = releaseAssets(ctx);
      writeFileSync(
        `${options.dir}/assets/manifest-${manifest.version}.js`,
        `window.__reactRouterManifest=${JSON.stringify(manifest)};`,
      );
    },
    applyToEnvironment(environment) {
      return environment.name === "client";
    },
    configEnvironment(name, envConfig) {
      if (name !== "client") return envConfig;

      const routes = ctx.componentRoutes ?? unreachable();
      return {
        ...envConfig,
        build: {
          manifest: true,
          outDir: "dist/client",
          target: "es2022",
          rollupOptions: {
            input: [
              "app/entry.client.ts",
              ...Object.values(routes).map((r) => r.file),
            ],
            preserveEntrySignatures: "exports-only",
          },
        },
        optimizeDeps: {
          entries: [
            "app/entry.client.ts",
            ...Object.values(routes).map((r) => r.file),
          ],
          include: [
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-dom",
            "react-dom/client",
          ],
        },
        resolve: {
          dedupe: ["react", "react-dom", "react-router", "@orange-js/orange"],
        },
      };
    },
  };
}

export function serverBuilder(ctx: Context): Plugin {
  return {
    name: "orange:server-builder",
    enforce: "pre",
    applyToEnvironment(environment) {
      return environment.name !== "client";
    },
    configEnvironment(name, config, env) {
      if (name === "client") return config;

      const routes = ctx.componentRoutes ?? unreachable();

      return {
        ...config,
        build: {
          ssr: true,
          emitAssets: true,
          outDir: `dist/${name}`,
          write: true,
          target: "es2022",
          rollupOptions: {
            input: "app/entry.server.ts",
            external: ["cloudflare:workers", "node:async_hooks"],
          },
        },
        optimizeDeps: {
          entries: [
            "app/entry.server.ts",
            ...Object.values(routes).map((r) => r.file),
          ],
          include: [
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-dom",
            "react-dom/server.edge",
          ],
        },
        resolve: {
          dedupe: [
            "react",
            "react-dom",
            "react-router",
            "react-dom/server.edge",
            "@orange-js/orange",
          ],
        },
      };
    },
  };
}
