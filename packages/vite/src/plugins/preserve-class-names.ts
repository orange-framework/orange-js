import * as path from "node:path";
import type { Plugin } from "vite";
import { isEcmaLike } from "../util.js";
import _parse from "@babel/parser";
import _generate from "@babel/generator";
import _traverse from "@babel/traverse";
import {
  callExpression,
  expressionStatement,
  identifier,
  memberExpression,
  objectExpression,
  objectProperty,
  staticBlock,
  stringLiteral,
  thisExpression,
  booleanLiteral,
} from "@babel/types";

const parse = _parse.parse;
const generate = _generate.default;
const traverse = _traverse.default;

export function preserveClassNames(): Plugin {
  return {
    name: "orange:preserve-class-names",
    enforce: "pre",
    transform(code, id) {
      if (!isEcmaLike(id) || !inAppDir(id)) {
        return;
      }

      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript", "decorators"],
      });

      traverse(ast, {
        ClassDeclaration(path) {
          const { id } = path.node;
          if (!id) return;

          path.node.body.body.unshift(
            staticBlock([
              expressionStatement(
                callExpression(
                  memberExpression(
                    identifier("Object"),
                    identifier("defineProperty"),
                  ),
                  [
                    thisExpression(),
                    stringLiteral("name"),
                    objectExpression([
                      objectProperty(
                        stringLiteral("value"),
                        stringLiteral(id.name),
                      ),
                      objectProperty(
                        stringLiteral("enumerable"),
                        booleanLiteral(false),
                      ),
                    ]),
                  ],
                ),
              ),
            ]),
          );
        },
      });

      return generate(ast).code;
    },
  };
}

const inAppDir = (importPath: string) =>
  path.resolve(importPath).startsWith(path.resolve("./app"));
