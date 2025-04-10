import { Cloudflare } from "cloudflare";
import { createCommand } from "@commander-js/extra-typings";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { select } from "../../prompts.js";
import { readAccountId } from "../../wrangler.js";
import { provisionPostgres } from "./postgres.js";
import { provisionSqlite } from "./sqlite.js";
import { provisionBucket } from "./object-storage.js";
import { provisionKv } from "./kv.js";

export function provisionCommand(client: Cloudflare) {
  return createCommand("provision")
    .description("Provision Cloudflare resources for your project")
    .action(async () => {
      const accountId = await readAccountId(client);

      const resources = [
        { title: "Object Storage Bucket", value: "bucket" },
        { title: "Key-Value Store", value: "kv" },
        { title: "SQLite Database", value: "sqlite" },
        { title: "Postgres Database", value: "postgres" },
      ];

      const selectedResource = await select({
        message: "Select a resource to provision",
        options: resources,
      });

      if (selectedResource === "postgres") {
        await provisionPostgres(client, accountId);
      } else if (selectedResource === "sqlite") {
        await provisionSqlite(client, accountId);
      } else if (selectedResource === "bucket") {
        await provisionBucket(client, accountId);
      } else if (selectedResource === "kv") {
        await provisionKv(client, accountId);
      }
    });
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
