import * as path from "node:path";
import { Plugin } from "vite";
import { Context } from "../index.js";
import { unreachable } from "../util.js";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import {
  isClassDeclaration,
  isIdentifier,
  isVariableDeclaration,
  exportNamedDeclaration,
  classDeclaration,
  classBody,
  isFunctionDeclaration,
} from "@babel/types";
import _generate from "@babel/generator";
const traverse = _traverse.default;
const generate = _generate.default;

const namesToStrip = ["action", "loader"];
const baseClassesToStrip = [
  "WorkerEntrypoint",
  "WorkflowEntrypoint",
  "RouteDurableObject",
  "DurableObject",
  "Agent",
  "AIChatAgent",
  "McpAgent"
];
const allNamesToStrip = [...namesToStrip, ...baseClassesToStrip];
const extensionsToParse = [".js", ".jsx", ".ts", ".tsx"];

export function removeDataStubs(ctx: Context): Plugin {
  return {
    name: "orange:remove-data-stubs",
    applyToEnvironment(environment) {
      return environment.name === "client";
    },
    async transform(code, id) {
      const routes = ctx.componentRoutes ?? unreachable();
      const isRouteModule = Object.values(routes)
        .map((route) => path.resolve(route.file))
        .some((path) => path === id);

      const hasExtension = extensionsToParse.some((ext) => id.endsWith(ext));
      if (!isRouteModule || !hasExtension) return;

      // Optimization: if the code doesn't contain any of the names we're looking for, skip parsing
      if (!allNamesToStrip.some((name) => code.includes(name))) {
        return;
      }

      const parsed = parse(code, {
        sourceType: "module",
        plugins: ["typescript", "jsx", ["decorators", {
          decoratorsBeforeExport: true,
          allowCallParenthesized: true,
        }]],
      });

      let stripped = false;

      traverse(parsed, {
        ExportNamedDeclaration(path) {
          const node = path.node;

          if (isVariableDeclaration(node.declaration)) {
            const declarations = node.declaration.declarations;
            for (let i = 0; i < declarations.length; i++) {
              const declaration = declarations[i];

              if (
                isIdentifier(declaration.id) &&
                namesToStrip.includes(declaration.id.name)
              ) {
                stripped = true;
                declarations.splice(i, 1);
              }
            }

            if (declarations.length === 0) {
              path.remove();
            }
          } else if (isClassDeclaration(node.declaration)) {
            const { superClass } = node.declaration;

            if (
              superClass &&
              isIdentifier(superClass) &&
              baseClassesToStrip.includes(superClass.name)
            ) {
              stripped = true;

              // TODO: remove the class declaration entirely without imports complaining
              path.replaceWith(
                exportNamedDeclaration(
                  classDeclaration(
                    node.declaration.id,
                    null,
                    classBody([]),
                    null,
                  ),
                ),
              );
            }
          } else if (isFunctionDeclaration(node.declaration)) {
            const { id } = node.declaration;

            if (id && isIdentifier(id) && namesToStrip.includes(id.name)) {
              stripped = true;
              path.remove();
            }
          }
        },
      });

      if (stripped) {
        const output = generate(parsed);
        return output.code;
      }
    },
  };
}
