import dedent from "dedent";
import chalk from "chalk";
import { Command } from "commander";
import { Config, resolveConfig } from "../config.js";
import { flatRoutes } from "@react-router/fs-routes";
import { loadRoutes } from "@orange-js/vite/routes";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";

export const typesCommand = new Command("types")
  .description("Generate TypeScript types for Cloudflare Workers")
  .action(async () => {
    const config = await resolveConfig();

    await generateWranglerTypes();
    await generateRouteTypes(config);
  });

function generateWranglerTypes() {
  return new Promise<void>((resolve, reject) => {
    console.log("Generating Wrangler types...");
    const wrangler = spawn("wrangler", ["types"]);
    const output: { type: "stdout" | "stderr"; data: string }[] = [];

    wrangler.stdout.on("data", (data) => {
      output.push({ type: "stdout", data: data.toString() });
    });

    wrangler.stderr.on("data", (data) => {
      output.push({ type: "stderr", data: data.toString() });
    });

    wrangler.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        for (const o of output) {
          if (o.type === "stderr") {
            process.stderr.write(o.data);
          } else {
            process.stdout.write(o.data);
          }
        }

        reject(new Error(`wrangler types failed with exit code ${code}`));
      }
    });
  });
}

async function generateRouteTypes(config: Config) {
  globalThis.__reactRouterAppDirectory = "app";
  const routes = await flatRoutes();
  const { manifest } = loadRoutes(
    routes,
    config.apiRoutePatterns ?? ["api*.{ts,js}"]
  );

  for (const route of Object.values(manifest)) {
    console.log(`Generating route types for ${chalk.whiteBright(route.file)}`);
    const newPath = route.file.replace(".tsx", ".ts").replace("app", ".types");

    const slashes = newPath.split("/").length - 1;
    const importPrefix = "../".repeat(slashes);
    const params = paramsForPath(route.path ?? "");
    const paramsLiteral = `{ ${params
      .map((param) => `"${param}": string`)
      .join(", ")} }`;

    await mkdir(dirname(newPath), { recursive: true });
    await writeFile(
      newPath,
      dedent`
        import type * as T from "@orange-js/orange/route-module"

        type Module = typeof import("${importPrefix}${route.file
        .replace(".tsx", "")
        .replace(".jsx", "")}")

        export type Info = {
          parents: [],
          id: "${route.id}"
          file: "${route.file}"
          path: "${route.path}"
          params: ${paramsLiteral} & { [key: string]: string | undefined }
          module: Module
          loaderData: T.CreateLoaderData<Module>
          actionData: T.CreateActionData<Module>
        }

        export namespace Route {
          export type LinkDescriptors = T.LinkDescriptors;
          export type LinksFunction = () => LinkDescriptors;

          export type MetaArgs = T.MetaArgs<Info>
          export type MetaDescriptors = T.MetaDescriptors
          export type MetaFunction = (args: MetaArgs) => MetaDescriptors

          export type HeadersArgs = T.HeadersArgs;
          export type HeadersFunction = (args: HeadersArgs) => Headers | HeadersInit;

          export type LoaderArgs = T.LoaderArgs<Info>;
          export type ClientLoaderArgs = T.ClientLoaderArgs<Info>;
          export type ActionArgs = T.ActionArgs<Info>;
          export type ClientActionArgs = T.ClientActionArgs<Info>;

          export type Component = T.Component<Info>;
          export type ComponentProps = T.ComponentProps<Info>;
          export type ErrorBoundaryProps = T.ErrorBoundaryProps<Info>;
          export type HydrateFallbackProps = T.HydrateFallbackProps<Info>;
        }
      `,
      {
        encoding: "utf-8",
      }
    );
  }
}

function paramsForPath(path: string) {
  const params: string[] = [];
  const segments = path.split("/");

  for (const segment of segments) {
    if (segment.startsWith(":")) {
      const paramName = segment.slice(1);
      params.push(paramName);
    }
  }

  return params;
}
