import type { Plugin } from "vite";
import { resolve } from "node:path";

import type { Context } from "../index.js";
import { unreachable } from "../util.js";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import {
  arrowFunctionExpression,
  awaitExpression,
  binaryExpression,
  blockStatement,
  callExpression,
  ClassMethod,
  identifier,
  ifStatement,
  isClassDeclaration,
  isIdentifier,
  memberExpression,
  objectExpression,
  returnStatement,
  variableDeclaration,
  variableDeclarator,
} from "@babel/types";
const traverse = _traverse.default;
const generate = _generate.default;

export function durableObjectRoutes(ctx: Context): Plugin {
  return {
    name: "orange:durable-object-routes",
    enforce: "pre",
    applyToEnvironment(environment) {
      return environment.name !== "client";
    },
    async transform(code, id) {
      const routes = ctx.componentRoutes ?? unreachable();
      const routeFiles = Object.values(routes).map((route) =>
        resolve(route.file)
      );
      if (!routeFiles.includes(id)) {
        return;
      }

      const className = durableObjectInCode(code);
      if (!className) {
        return;
      }

      const parsed = parse(code, {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
      });

      let wrapped = false;

      traverse(parsed, {
        ExportNamedDeclaration(path) {
          const node = path.node;
          if (isClassDeclaration(node.declaration)) {
            const classDeclaration = node.declaration;

            if (
              isIdentifier(classDeclaration.superClass) &&
              classDeclaration.superClass.name === "RouteDurableObject"
            ) {
              traverse(
                classDeclaration,
                {
                  ClassMethod(path) {
                    if (updateDataMethod(path)) {
                      wrapped = true;
                    }
                  },
                },
                path.scope,
                path
              );
            }
          }

          path.stop();
        },
      });

      const output = generate(parsed);
      return {
        code: dataFunctionsSuffix(output.code, className),
        map: output.map,
      }
    },
  };
}

const nonDataMethods = [
  "fetch",
  "webSocketConnect",
  "webSocketMessage",
  "webSocketClose",
  "alarm",
];

function updateDataMethod(path: _traverse.NodePath<ClassMethod>): boolean {
  const { node } = path;

  if (!isIdentifier(node.key)) {
    return false;
  }

  if (nonDataMethods.includes(node.key.name)) {
    return false;
  }

  const callToBody = callExpression(
    arrowFunctionExpression([], node.body, node.async),
    []
  );

  node.body = blockStatement([
    variableDeclaration("const", [
      variableDeclarator(
        identifier("ret"),
        node.async ? awaitExpression(callToBody) : callToBody
      ),
    ]),
    ifStatement(
      binaryExpression(
        "instanceof",
        identifier("ret"),
        identifier("Response")
      ),
      blockStatement([
        returnStatement(identifier("ret")),
      ]),
    ),
    ifStatement(
      callExpression(
        memberExpression(
          callExpression(
          
            memberExpression(
              identifier("Object"),
              identifier("getPrototypeOf")
            ),
            [identifier("ret")]
          ),
          identifier("isPrototypeOf")
        ),
        [
          objectExpression([]),
        ]
      ),
      blockStatement([
        returnStatement(identifier("ret")),
      ]),
    ),
    returnStatement(
      callExpression(
        memberExpression(identifier("JSON"), identifier("parse")),
        [
          callExpression(
            memberExpression(identifier("JSON"), identifier("stringify")),
            [identifier("ret")]
          ),
        ]
      )
    ),
  ]);

  return true;
}

const dataFunctionsSuffix = (code: string, className: string) => `${code}\n
export async function loader(args) {
  const env = args.context?.cloudflare.env as unknown as Env;
  if (!env) {
    throw new Error("No env found in context");
  }

  const namespace = env.${className};
  const name = typeof ${className}.id === "string" ? ${className}.id : ${className}.id(args);
  if (name === undefined) {
    throw new Error("DurableObject did not have a static id function specified");
  }
  const doID = namespace.idFromName(name);
  const stub = namespace.get(doID);

  if (args.request.headers.get("Upgrade") === "websocket") {
    const modifiedRequest = new Request(args.request, {
      headers: new Headers({
        ...Object.fromEntries(args.request.headers),
        "x-orange-params": JSON.stringify(args.params),
      })
    });

    return await stub.fetch(modifiedRequest);
  }

  delete args.context;
  delete args.env;

  return await (stub as any).loader(args);
}

export async function action(args) {
  const env = args.context?.cloudflare.env as unknown as Env;
  if (!env) {
    throw new Error("No env found in context");
  }

  const namespace = env.${className};
  const name = typeof ${className}.id === "string" ? ${className}.id : ${className}.id(args);
  if (name === undefined) {
    throw new Error("DurableObject did not have a static id function specified");
  }
  const doID = namespace.idFromName(name);
  const stub = namespace.get(doID);

  if (args.request.headers.get("Upgrade") === "websocket") {
    const modifiedRequest = new Request(args.request, {
      headers: new Headers({
        ...Object.fromEntries(args.request.headers),
        "x-orange-params": JSON.stringify(args.params),
      })
    });

    return await stub.fetch(modifiedRequest);
  }

  delete args.context;
  delete args.env;

  return await (stub as any).action(args);
}`;

function durableObjectInCode(contents: string): string | undefined {
  const matches = /export\s+class\s+(\w+)\s+extends\s+RouteDurableObject/.exec(
    contents
  );
  if (!matches || !matches[1]) {
    return undefined;
  }

  return matches[1];
}
