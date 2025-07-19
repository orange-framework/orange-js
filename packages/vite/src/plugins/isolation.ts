/*
  Allows for creating modules that are isolated from client or server bundles by using
  a `.client` or `.server` suffix.
 */
import * as path from "node:path";
import { Plugin } from "vite";
import { init, parse } from "es-module-lexer";

export function isolation(): Plugin[] {
  const clientRegex = /.+.client(?:.(?:j|t)sx?)?$/g;
  const serverRegex = /.+.server(?:.(?:j|t)sx?)?$/g;

  return [
    {
      // Prevent client-only modules from being imported in the server bundle
      name: "orange:client-isolation",
      applyToEnvironment(environment) {
        return environment.name !== "client";
      },
      async transform(code, id) {
        if (clientRegex.test(id) && inAppDir(id)) {
          this.debug(`Client-only module ${id} is being isolated`);

          await init;

          const [_, exports] = parse(code);

          return emptyExports(exports.map((it) => it.n));
        }
      },
    },
    {
      // Prevent server-only modules from being imported in the client bundle
      name: "orange:server-isolation",
      applyToEnvironment(environment) {
        return environment.name === "client";
      },
      async transform(code, id) {
        if (serverRegex.test(id) && inAppDir(id)) {
          this.debug(`Server-only module ${id} is being isolated`);

          await init;

          const [_, exports] = parse(code);

          return emptyExports(exports.map((it) => it.n));
        }
      },
    },
  ];
}

const inAppDir = (importPath: string) =>
  path.resolve(importPath).startsWith(path.resolve("./src"));

const emptyExports = (exports: string[]) => {
  return exports
    .map((e) =>
      e === "default"
        ? "export default undefined;"
        : `export const ${e} = undefined;`
    )
    .join("\n");
};
