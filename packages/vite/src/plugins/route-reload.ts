import { Plugin, ViteDevServer } from "vite";
import * as path from "node:path";
import { resetRoutes } from "./routes.js";
import { resetConfig, resolveConfig, ResolvedConfig } from "../config.js";

// Prevent double reload for file renames
let reloadCount = 0;

async function forceReload(
  server: ViteDevServer,
  reloadId: number,
  updateConfig: (newConfig: ResolvedConfig) => void,
) {
  if (reloadId !== reloadCount) {
    return;
  }

  resetRoutes();
  resetConfig();
  updateConfig(await resolveConfig());

  // TODO: This is a hack to force a full reload
  await server.restart();
  server.ws.send({ type: "full-reload" });
}

const pathsToWatch = ["orange.config.ts", "orange.config.js", "app/routes"].map(
  (file) => path.resolve(file),
);

export function routeReload(
  updateConfig: (newConfig: ResolvedConfig) => void,
): Plugin {
  return {
    name: "orange:reload-routes",
    async configureServer(server) {
      const onFileChange = async (filePath: string) => {
        if (
          pathsToWatch.includes(filePath) ||
          pathsToWatch.some((p) => filePath.startsWith(p))
        ) {
          const reloadId = ++reloadCount;
          setTimeout(() => forceReload(server, reloadId, updateConfig), 100);
        }
      };

      server.watcher.on("add", onFileChange);
      server.watcher.on("unlink", onFileChange);
    },
  };
}
