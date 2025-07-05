// TODO: burn this file with fire
import { Plugin } from "vite";
import { VirtualModule } from "../virtual-module.js";

const EMPTY = new VirtualModule("empty");
const INTERNAL = new VirtualModule("internal");

const emptyExports = (exports: string[]) => {
  return exports.map((e) => `export const ${e} = undefined;`).join("\n");
};

export function internal(): Plugin[] {
  return [
    {
      name: "orange:shimmed-workflows",
      enforce: "pre",
      applyToEnvironment(environment) {
        return environment.name === "client";
      },
      resolveId(id) {
        if (id === "@orange-js/orange/workflows") {
          return EMPTY.id;
        } else  if (id === "@orange-js/orange/hono") {
          return EMPTY.id;
        }
      },
      load(id) {
        if (EMPTY.is(id)) {
          return emptyExports(["start", "get", "variables"]);
        }
      },
    },
    {
      name: "orange:shimmed-internal",
      enforce: "pre",
      applyToEnvironment(environment) {
        return environment.name === "client";
      },
      resolveId(id) {
        if (id === "./internal.js") {
          return INTERNAL.id;
        }
      },
      load(id) {
        if (INTERNAL.is(id)) {
          return emptyExports(["env", "contextFn"]);
        }
      },
    },
  ];
}
