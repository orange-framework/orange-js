import { Context } from "../index.js";
import { unreachable } from "../util.js";
import { VirtualModule } from "../virtual-module.js";
import { Plugin } from "vite";

const ENTRYPOINTS_VIRTUAL_MODULE = new VirtualModule("entrypoints");

export function entrypoints(ctx: Context): Plugin {
  return {
    name: "orange:entrypoints-virtual-module",
    enforce: "pre",
    resolveId(id) {
      if (ENTRYPOINTS_VIRTUAL_MODULE.is(id)) {
        return id;
      }
    },
    load(id) {
      if (ENTRYPOINTS_VIRTUAL_MODULE.is(id)) {
        const routes = ctx.componentRoutes ?? unreachable();
        let body = "";

        for (const route of Object.values(routes)) {
          // Only process JS/TS files
          if (!/\.(t|j)sx?$/.test(route.file)) {
            continue;
          }

          const exportedClasses = route.exportedClasses ?? [];
          if (exportedClasses.length === 0) {
            continue;
          }

          body += `export { ${exportedClasses.join(", ")} } from "/${
            route.file
          }";\n`;
        }

        return body;
      }
    },
  };
}
