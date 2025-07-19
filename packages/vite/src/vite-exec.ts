import { createServer, version as viteVersion } from "vite";
import { ViteNodeRunner } from "vite-node/client";
import { ViteNodeServer } from "vite-node/server";
import { installSourcemapsSupport } from "vite-node/source-map";

export async function execVite(file: string) {
  const server = await createServer({
    server: {
      preTransformRequests: false,
      hmr: false,
      watch: null,
    },
    ssr: {
      external: [],
    },
    optimizeDeps: {
      noDiscovery: true,
    },
    css: {
      postcss: {},
    },
    configFile: false,
    envFile: false,
    plugins: [],
  });

  // @ts-ignore
  const node = new ViteNodeServer(server);

  installSourcemapsSupport({
    getSourceMap: (source) => node.getSourceMap(source),
  });

  const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    fetchModule(id) {
      return node.fetchModule(id);
    },
    resolveId(id, importer) {
      return node.resolveId(id, importer);
    },
  });

  const result = await runner.executeFile(file);
  await server.close();

  return result;
}
