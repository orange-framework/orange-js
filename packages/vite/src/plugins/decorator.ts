import { Plugin } from "vite";
import { ParserConfig, transform } from "@swc/core";

const extensionsToParse = [".js", ".jsx", ".ts", ".tsx"];

export function decoratorPlugin(): Plugin {
  return {
    name: "orange:decorator",
    async transform(code, id) {
      if (!extensionsToParse.some((ext) => id.endsWith(ext))) {
        return;
      }

      const isTs = id.endsWith(".ts") || id.endsWith(".tsx");

      const parser: ParserConfig = isTs ? {
        syntax: "typescript",
        tsx: true,
        decorators: true,
      } as const : {
        syntax: "ecmascript",
        jsx: true,
        decorators: true,
        decoratorsBeforeExport: true,
      } as const;

      const output = await transform(code, {
        jsc: {
          target: "esnext",
          parser,
          transform: {
            decoratorVersion: "2022-03",
          },
        },
      });

      if (!output) {
        return;
      }
      return { code: output.code, map: output.map };
    },
  };
}
