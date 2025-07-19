import { Cloudflare } from "cloudflare";
import { createCommand } from "@commander-js/extra-typings";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assertNotCancelled, select } from "../../prompts.js";
import { readAccountId } from "../../wrangler.js";
import { provisionPostgres } from "./postgres.js";
import { provisionSqlite } from "./sqlite.js";
import { provisionBucket } from "./object-storage.js";
// import { provisionDurableObjects } from "./durable-objects.js";
import { provisionKv } from "./kv.js";

export function provisionCommand(client: Cloudflare) {
  return createCommand("provision")
    .description("Provision Cloudflare resources for your project")
    // .option("-d, --durable-objects", "Provision Durable Objects")
    .option("-k, --kv", "Provision Key-Value Store")
    .option("-s, --sqlite", "Provision SQLite Database")
    .option("-D, --d1", "Provision D1 Database")
    .option("-b, --bucket", "Provision Object Storage Bucket")
    .option("-R, --r2", "Provision R2 Bucket")
    .option("-p, --postgres", "Provision Postgres Database")
    .action(async (options) => {
      const accountId = await readAccountId(client);
      const selectedResource = await determineResource(options);

      if (selectedResource === "postgres") {
        await provisionPostgres(client, accountId);
      } else if (selectedResource === "sqlite") {
        await provisionSqlite(client, accountId);
      } else if (selectedResource === "bucket") {
        await provisionBucket(client, accountId);
      } else if (selectedResource === "kv") {
        await provisionKv(client, accountId);
      } else if (selectedResource === "durable-objects") {
        // await provisionDurableObjects();
      }
    });
}

async function determineResource(options: {
  // durableObjects?: true;
  kv?: true;
  sqlite?: true;
  d1?: true;
  bucket?: true;
  r2?: true;
  postgres?: true;
}): Promise<string> {
  // if (options.durableObjects) {
  //   return "durable-objects";
  // }

  if (options.kv) {
    return "kv";
  }

  if (options.sqlite || options.d1) {
    return "sqlite";
  }

  if (options.bucket || options.r2) {
    return "bucket";
  }

  if (options.postgres) {
    return "postgres";
  }

  const resources = [
    { title: "Object Storage Bucket", value: "bucket" },
    { title: "Key-Value Store", value: "kv" },
    { title: "SQLite Database", value: "sqlite" },
    { title: "Postgres Database", value: "postgres" },
    // { title: "Durable Objects", value: "durable-objects" },
  ];

  const selectedResource = await select({
    message: "Select a resource to provision",
    options: resources,
  });
  assertNotCancelled(selectedResource);

  return selectedResource;
}

export function camelCase(str: string) {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function installedNodeModules(): string[] {
  const packageJson = readFileSync(join(process.cwd(), "package.json"), "utf8");
  const json = JSON.parse(packageJson);
  return json.dependencies ? Object.keys(json.dependencies) : [];
}

export function isDrizzleInstalled() {
  const installed = installedNodeModules();
  return installed.includes("drizzle-orm");
}
