// @ts-nocheck - TODO(zebp): re-enable this once RSC is more mature
import * as fs from "node:fs/promises";
import { flatRoutes } from "@react-router/fs-routes";
import { loadRoutes } from "@orange-js/vite/routes";
import { Config, resolveConfig } from "../../config.js";
import { Cloudflare } from "cloudflare";
import { loader, multiselect, error } from "../../prompts.js";
import { assertNotCancelled } from "../../prompts.js";
import {
  unstable_readConfig as readWranglerConfig,
  experimental_patchConfig as patchConfig,
} from "wrangler";
import { generateWranglerTypes } from "../types.js";

export async function findDurableObjects(config: Config) {
  globalThis.__reactRouterAppDirectory = "app";
  const routes = await flatRoutes();
  const { manifest } = loadRoutes(
    routes,
    config.apiRoutePatterns ?? ["api*.{ts,js}"],
  );

  const manifestEntries = Object.values(manifest);
  const fileContents = await Promise.all(
    manifestEntries.map((route) => fs.readFile(route.file, "utf-8")),
  );

  const durableObjectNames = fileContents
    .map(durableObjectInCode)
    .filter((name): name is string => name !== undefined);

  return durableObjectNames;
}

function durableObjectInCode(contents: string): string | undefined {
  const matches = /export\s+class\s+(\w+)\s+extends\s+RouteDurableObject/.exec(
    contents,
  );
  if (!matches || !matches[1]) {
    return undefined;
  }

  return matches[1];
}

export async function provisionDurableObjects() {
  const config = await resolveConfig();

  const wranglerConfig = readWranglerConfig({});
  const durableObjects = await findDurableObjects(config);

  const provisionedDurableObjects = wranglerConfig.durable_objects.bindings.map(
    (binding) => binding.class_name,
  );

  const nonProvisionedDurableObjects = durableObjects.filter(
    (durableObject) => !provisionedDurableObjects.includes(durableObject),
  );

  if (nonProvisionedDurableObjects.length === 0) {
    error("No Durable Objects to provision.");
    return;
  }

  const provisionDurableObjects = await multiselect({
    message: `${nonProvisionedDurableObjects.length} Durable Objects that need to be provisioned.`,
    options: nonProvisionedDurableObjects.map((durableObject) => ({
      title: durableObject,
      value: durableObject,
    })),
  });
  assertNotCancelled(provisionDurableObjects);

  patchConfig(wranglerConfig.configPath!, {
    durable_objects: {
      bindings: provisionDurableObjects.map((durableObject) => ({
        class_name: durableObject,
        name: durableObject,
      })),
    },
    migrations: [
      {
        tag: `${new Date().toISOString()}-${provisionDurableObjects.join("-")}`,
        new_sqlite_classes: provisionDurableObjects,
      },
    ],
  });

  await loader(generateWranglerTypes(), {
    start: "Generating Wrangler types...",
    success: () => "Wrangler types generated",
    error: "Failed to generate Wrangler types",
  });
}
