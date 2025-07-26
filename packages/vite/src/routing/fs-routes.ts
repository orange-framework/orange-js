import { readdirSync } from "node:fs";
import * as path from "node:path";
import { isEcmaLike } from "../util.js";
import type { Route } from "./index.js";

export function fsRoutes(): Route[] {
  const routesDir = path.resolve(process.cwd(), "app", "routes");
  const routes = walkDir(routesDir).map((route) =>
    route.replace(`${routesDir}/`, "")
  );

  return routes
    .filter((route) => isEcmaLike(route))
    .filter((route) => !isBrowserFile(route))
    .map((route) => {
      const pattern = fileNameToPattern(route);

      return {
        pattern,
        file: path.resolve(routesDir, route),
      };
    });
}

function fileNameToPattern(fileName: string) {
  let pattern =
    "/" + fileName.replace(/\.(t|j)sx?$/, "").replace(/\/index$/, "");

  if (pattern === "/index") {
    pattern = "/";
  }

  if (pattern.endsWith("/index")) {
    pattern = pattern.slice(0, -6);
  }

  return pattern.replace("$", ":");
}

function walkDir(dir: string) {
  let files: string[] = [];

  const dirents = readdirSync(dir, { withFileTypes: true });

  for (const dirent of dirents) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isSymbolicLink()) continue;

    if (dirent.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else if (dirent.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function isBrowserFile(fileName: string) {
  return /\.browser\.(tsx?|jsx?)$/.test(fileName);
}
