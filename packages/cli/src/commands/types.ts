import dedent from "dedent";
import chalk from "chalk";
import { createCommand } from "@commander-js/extra-typings";
import { ResolvedConfig, resolveConfig } from "@orange-js/vite/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { exec } from "../exec.js";
import { step } from "../prompts.js";

export const typesCommand = createCommand("types")
  .description("Generate TypeScript types for Cloudflare Workers")
  .option("--no-wrangler", "Skip generating Wrangler types")
  .action(async (options) => {
    const config = await resolveConfig();

    if (options.wrangler) {
      step("Generating Wrangler types...");
      await generateWranglerTypes();
    }

    await generateRouteTypes(config);
  });

export async function generateWranglerTypes() {
  await exec("wrangler", ["types"]);
}

async function generateRouteTypes(config: ResolvedConfig) {
  const routes = config.routes;

  for (const route of routes) {
    step(`Generating route types for ${chalk.whiteBright(route.file)}`, true);
    const newPath = route.file.replace(".tsx", ".ts").replace("app", ".types");

    const slashes = newPath.split("/").length - 1;
    const importPrefix = "../".repeat(slashes);
    const params = paramsForPath(route.pattern);
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
