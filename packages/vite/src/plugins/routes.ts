import type { Plugin } from "vite";
import { VirtualModule } from "../virtual-module.js";
import * as path from "node:path";
import { fsRoutes } from "../routing/fs-routes.js";
import { Route } from "../routing/index.js";
import { Config } from "../config.js";

const vmod = new VirtualModule("routes");

let _routes: Route[] | undefined;

export function resetRoutes() {
  _routes = undefined;
}

export function routesPlugin(config: () => Config): Plugin {
  return {
    name: "orange:routes",
    enforce: "pre",
    applyToEnvironment(environment) {
      return environment.name === "rsc";
    },
    resolveId(source) {
      if (source === "virtual:orange/routes") {
        return vmod.id;
      }
    },
    async load(id) {
      if (id === vmod.id) {
        const routes = _routes ?? config().routes ?? fsRoutes();
        _routes = routes;

        const ids = Object.fromEntries(
          routes.map((route) => [
            route.pattern,
            `route_${Math.random().toString(36).substring(2, 15)}`,
          ]),
        );
        const imports = routes.map((route) => {
          return `import * as ${ids[route.pattern]} from "${path.resolve(
            route.file,
          )}";`;
        });

        const routeDeclarations = routes.map(
          (route) =>
            `{ pattern: new URLPattern({ pathname: "${
              route.pattern
            }" }), module: ${ids[route.pattern]} }`,
        );

        return {
          code: `${imports.join("\n")}
          export const routes = [${routeDeclarations.join(",\n")}];
          `,
        };
      }
    },
  };
}
