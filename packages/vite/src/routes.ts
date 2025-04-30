import fs from "node:fs";
import { flatRoutes } from "@react-router/fs-routes";
import { unreachable, isEcmaLike } from "./util.js";
import { minimatch } from "minimatch";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import { isIdentifier } from "@babel/types";
const traverse = _traverse.default;

// TOOD: use AST for this, this is a hack
function loadRoute(file: string) {
  if (!isEcmaLike(file)) {
    return {
      hasLoader: false,
      hasAction: false,
      hasClientLoader: false,
      hasClientAction: false,
    }
  }

  const contents = fs.readFileSync(file, "utf-8");
  const ast = parse(contents, {
    sourceType: "module",
    plugins: ["typescript", "jsx", "decorators"],
  });

  const routeInfo = {
    hasLoader: false,
    hasAction: false,
    hasClientLoader: false,
    hasClientAction: false,
    exportedClasses: [] as string[],
  };

  traverse(ast, {
    ExportNamedDeclaration(path) {
      const node = path.node;
      const declaration = node.declaration;

      if (declaration === undefined || declaration === null) {
        return;
      }

      if (declaration.type === "ClassDeclaration" && declaration.id) {
        routeInfo.exportedClasses.push(declaration.id.name);

        const members: Record<string, boolean> = {};

        traverse(declaration, {
          ClassMethod(path) {
            const node = path.node;
            if (node.kind === "method" && isIdentifier(node.key)) {
              members[node.key.name] = node.static;
            }
          },
          ClassProperty(path) {
            const node = path.node;
            if (isIdentifier(node.key)) {
              members[node.key.name] = node.static;
            }
          },
        }, path.scope);
        
        // Ensure that the loader and action exist and there is a static id method or property
        routeInfo.hasLoader ||= "loader" in members && members.id;
        routeInfo.hasAction ||= "action" in members && members.id;
      } else if ((declaration.type === "FunctionDeclaration" || declaration.type === "DeclareVariable") && declaration.id) {
        routeInfo.hasLoader ||= declaration.id.name === "loader";
        routeInfo.hasAction ||= declaration.id.name === "action";
        routeInfo.hasClientLoader ||= declaration.id.name === "clientLoader";
        routeInfo.hasClientAction ||= declaration.id.name === "clientAction";
      }
    },
  });

  return routeInfo;
}

export interface RouteManifestEntry {
  /**
   * The path this route uses to match on the URL pathname.
   */
  path?: string;
  /**
   * The unique id for this route, named like its `file` but without the
   * extension. So `app/routes/gists/$username.tsx` will have an `id` of
   * `routes/gists/$username`.
   */
  id: string;

  /**
   * The unique `id` for this route's parent route, if there is one.
   */
  parentId?: string;

  /**
   * The path to the entry point for this route, relative to
   * `config.appDirectory`.
   */
  file: string;
  index?: boolean;
  hasAction?: boolean;
  hasLoader?: boolean;
  hasClientAction?: boolean;
  hasClientLoader?: boolean;
  hasErrorBoundary?: boolean;
  exportedClasses?: string[];
}

export interface RouteManifest {
  [routeId: string]: RouteManifestEntry;
}

type RouteConfigEntry = Awaited<ReturnType<typeof flatRoutes>>[number];

export type ApiRoute = {
  file: string;
  path: string;
};

type LoadedRoutes = {
  manifest: RouteManifest;
  apiRoutes: ApiRoute[];
};

export function loadRoutes(
  routes: RouteConfigEntry[],
  apiRoutePatterns: string[]
): LoadedRoutes {
  const root: RouteManifestEntry = {
    id: "root",
    file: "app/root.tsx",
    path: "",
    ...loadRoute("app/root.tsx"),
  };
  const manifest: RouteManifest = { root };

  const recurse = (route: RouteConfigEntry, parentId?: string) => {
    if (route.id === undefined) unreachable();

    manifest[route.id] = {
      id: route.id,
      parentId,
      ...route,
      file: `app/${route.file}`,
      ...loadRoute(`app/${route.file}`),
    };

    if (route.children) {
      route.children.forEach((child) => recurse(child, route.id));
    }
  };

  const topLevelApiRoutes = routes.filter((it) =>
    apiRoutePatterns.some((pattern) =>
      minimatch(it.file.replace("routes/", ""), pattern)
    )
  );
  const apiRoutes = topLevelApiRoutes.flatMap(collectApiRoutes);

  routes
    .filter((it) => topLevelApiRoutes.every((api) => it.file !== api.file))
    .forEach((route) => recurse(route, "root"));

  return { manifest, apiRoutes };
}

function collectApiRoutes(route: RouteConfigEntry): ApiRoute[] {
  const results: ApiRoute[] = [];

  if (route.path) {
    results.push({
      file: `app/${route.file}`,
      path: route.path,
    });
  }

  if (route.children) {
    route.children.forEach((child) => {
      results.push(...collectApiRoutes(child));
    });
  }

  return results;
}
