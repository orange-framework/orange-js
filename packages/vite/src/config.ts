import fs from "node:fs";
import { Route } from "./routing/index.js";
import { execVite } from "./vite-exec.js";
import { fsRoutes } from "./routing/fs-routes.js";

export type Config = {
  /**
   * The routes in the application.
   */
  routes?: Route[];
};

export type ResolvedConfig = Required<Config>;

let _configPromise: Promise<ResolvedConfig> | undefined;

let defaultConfig: ResolvedConfig = {
  routes: fsRoutes(),
};

async function resolveConfigImpl(): Promise<ResolvedConfig> {
  for (const file of ["orange.config.ts", "orange.config.js"]) {
    if (fs.existsSync(file)) {
      const mod = await execVite(file);
      const config = mod.default;
      if (!config) {
        console.error("orange.config.ts did not export a default config");
        process.exit(1);
      }
      return { ...defaultConfig, ...config };
    }
  }

  return defaultConfig;
}

export async function resolveConfig(): Promise<ResolvedConfig> {
  if (!_configPromise) {
    _configPromise = resolveConfigImpl();
  }
  return _configPromise;
}

export function resetConfig() {
  defaultConfig = { routes: fsRoutes() };
  _configPromise = undefined;
}
