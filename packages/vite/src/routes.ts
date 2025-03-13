import fs from "node:fs";
import { flatRoutes } from "@react-router/fs-routes";
import { unreachable } from "./util.js";
import { minimatch } from "minimatch";

// TOOD: use AST for this, this is a hack
function loadRoute(file: string) {
  const contents = fs.readFileSync(file, "utf-8");
  return {
    hasLoader:
      contents.includes("async loader(") ||
      contents.includes("async webSocketConnect(") ||
      contents.includes("export async function loader") ||
      contents.includes("export function loader") ||
      contents.includes("export const loader = ") ||
      contents.includes("export let loader = "),
    hasAction:
      contents.includes("async action(") ||
      contents.includes("export async function action") ||
      contents.includes("export function action") ||
      contents.includes("export const action = ") ||
      contents.includes("export let action = "),
    hasClientLoader:
      contents.includes("export async function clientLoader") ||
      contents.includes("export function clientLoader") ||
      contents.includes("export const clientLoader") ||
      contents.includes("export let clientLoader"),
    hasClientAction:
      contents.includes("export async function clientAction") ||
      contents.includes("export function clientAction") ||
      contents.includes("export const clientAction") ||
      contents.includes("export let clientAction"),
    exportedClasses:
      contents
        .match(/export class (\w+)/g)
        ?.map((it) => it.replace("export class ", "")) ?? [],
  };
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
