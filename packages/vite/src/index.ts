import type { PluginOption } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";
import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";
import * as fs from "node:fs";
import * as path from "node:path";

import { configPlugin } from "./plugins/config.js";
import { routesPlugin } from "./plugins/routes.js";
import { isolation } from "./plugins/isolation.js";
import { Config, resolveConfig } from "./config.js";

export * from "./routing/fs-routes.js";

export type OrangeRSCPluginOptions = {
  cloudflare?: Parameters<typeof cloudflare>[0];
};

export default function orange(
  options: OrangeRSCPluginOptions = {}
): PluginOption[] {
  let _config: Config;

  const config = () => _config;

  return [
    {
      name: "orange:settings",
      // @ts-ignore - this is a magic property used for the orange CLI
      orangeOptions: {
        cloudflare: options.cloudflare,
      },
      async config() {
        _config = await resolveConfig();
      },
    },
    isolation(),
    configPlugin(),
    react({
      babel: {
        plugins: [
          ["@babel/plugin-proposal-decorators", { version: "2023-11" }],
        ],
      },
    }),
    rsc({
      entries: {
        client: entrypoint(
          "entry.browser",
          "node_modules/@orange-js/vite/dist/entrypoints/entry.browser.js"
        ),
        ssr: entrypoint(
          "entry.ssr",
          "node_modules/@orange-js/vite/dist/entrypoints/entry.ssr.js"
        ),
        // rsc: entrypoint(
        //   "entry.rsc",
        //   "node_modules/@orange-js/vite/dist/entrypoints/entry.rsc.js"
        // ),
      },
      serverHandler: false,
      loadModuleDevProxy: true,
    }),
    cloudflare(
      options.cloudflare ?? {
        configPath: "./wrangler.jsonc",
        viteEnvironment: {
          name: "rsc",
        },
      }
    ),
    routesPlugin(config),
  ];
}

function entrypoint(name: string, fallback: string) {
  for (const extension of ["tsx", "jsx"]) {
    const entrypoint = path.join(
      process.cwd(),
      "src",
      "entrypoints",
      `${name}.${extension}`
    );
    if (fs.existsSync(entrypoint)) {
      return entrypoint;
    }
  }

  return fallback;
}
