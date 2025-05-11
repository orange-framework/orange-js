import { type Plugin } from "vite";
import type { Context } from "../index.js";
import { VirtualModule } from "../virtual-module.js";
import { unreachable } from "../util.js";
import dedent from "dedent";
import { devAssets, releaseAssets } from "../assets.js";

const routesVirtualId = new VirtualModule("server-bundle");

/*
This plugin is responsible for generating a `ServerBuild` object from React-Router
so that we can re-use their SSR modules.
*/
export function serverBundle(ctx: Context): Plugin {
  return {
    name: "orange:server-bundle",
    enforce: "pre",
    resolveId(id) {
      if (routesVirtualId.is(id)) {
        return routesVirtualId.id;
      }
    },
    async load(id) {
      if (!routesVirtualId.is(id)) {
        return;
      }

      const componentRoutes = ctx.componentRoutes ?? unreachable();
      const componentRouteImports = Object.values(componentRoutes).map(
        (route, index) =>
          `import * as componentRouteModule${index} from "/${route.file}";`,
      );
      const componentRouteLiterals = Object.values(componentRoutes).map(
        (route, index) => `"${route.id}": {
          id: ${JSON.stringify(route.id)},
          parentId: ${JSON.stringify(route.parentId)},
          path: ${JSON.stringify(route.path)},
          index: ${JSON.stringify(route.index)},
          caseSensitive: true,
          module: componentRouteModule${index},
        }`,
      );

      const apiRoutes = ctx.apiRoutes ?? unreachable();
      const apiRouteImports = apiRoutes.map(
        (route, index) =>
          `import * as apiRouteModule${index} from "/${route.file}";`,
      );
      const apiRouteLiterals = Object.values(apiRoutes).map(
        (route, index) =>
          `"${route.path.replaceAll("$", ":")}": apiRouteModule${index}`,
      );

      const assets = ctx.clientManifest ? releaseAssets(ctx) : devAssets(ctx);

      return dedent`
      import * as serverModule from "@orange-js/orange/server-entry";

      ${componentRouteImports.join("\n")}
      ${apiRouteImports.join("\n")}

      export const prerender = [];
      export const entry = { module: serverModule };
      export const future = { unstable_optimizeDeps: false };
      export const basename = "/";
      export const publicPath = "/";
      export const isSpaMode = false;
      export const ssr = true;
      export const assetsBuildDirectory = "dist/client";
      export const assets = ${JSON.stringify(assets, null, 2)};
      export const routes = {${componentRouteLiterals.join(",")}};
      export const routeDiscovery = { mode: "lazy", manifestPath: "/__manifest" };
      export const apiRoutes = {${apiRouteLiterals.join(",")}};
      `;
    },
  };
}
