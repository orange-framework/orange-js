import c from "chalk";
import dedent from "dedent";
import { Cloudflare } from "cloudflare";
import {
  unstable_readConfig as readWranglerConfig,
  experimental_patchConfig as patchConfig,
} from "wrangler";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  warn,
  text,
  loader,
  assertNotCancelled,
  select,
  step,
  log,
  orange,
} from "../../prompts.js";
import { camelCase, isDrizzleInstalled } from "./index.js";
import { generateWranglerTypes } from "../types.js";

export async function provisionSqlite(client: Cloudflare, accountId: string) {
  const config = readWranglerConfig({});
  const existing = await loader(existingDatabaseNames(client, accountId), {
    start: "Fetching existing databases...",
    success: (value) => `Found ${value.length} existing databases`,
    error: "Failed to fetch existing databases",
  });

  const sqliteName = await text({
    message: "Enter the name of the SQLite database",
    placeholder: "my-database",
    validate(value) {
      if (value.length === 0) {
        return "Database name cannot be empty";
      }

      if (existing.includes(value.toLowerCase())) {
        return `Database ${value} already exists`;
      }
    },
  });
  assertNotCancelled(sqliteName);

  const locationHint = await select<
    "wnam" | "enam" | "weur" | "eeur" | "apac" | "oc" | undefined
  >({
    message: "Do you want a primary region hint for your database?",
    options: [
      { title: "Automatic", value: undefined },
      { title: "US East", value: "wnam" },
      { title: "US West", value: "enam" },
      { title: "EU West", value: "weur" },
      { title: "EU East", value: "eeur" },
      { title: "Asia Pacific", value: "apac" },
      { title: "Oceania", value: "oc" },
    ],
  });
  assertNotCancelled(locationHint);

  const database = await loader(
    client.d1.database.create({
      account_id: accountId,
      name: sqliteName,
      primary_location_hint: locationHint,
    }),
    {
      start: "Creating database...",
      success: () => "Database created",
      error: "Failed to create database",
    },
  );

  const extraDbConfig = isDrizzleInstalled()
    ? {
        migrations_dir: "drizzle/migrations",
      }
    : {};

  patchConfig(
    config.configPath!,
    {
      d1_databases: [
        {
          binding: camelCase(sqliteName),
          database_name: sqliteName,
          database_id: database.uuid,
          ...extraDbConfig,
        },
      ],
    },
    true,
  );

  await loader(generateWranglerTypes(), {
    start: "Generating Wrangler types...",
    success: () => "Generated Wrangler types",
    error: "Failed to generate Wrangler types",
  });

  if (isDrizzleInstalled()) {
    const databaseFile = databaseFileTemplate(
      sqliteName,
      [
        'import { drizzle } from "drizzle-orm/d1";',
        'import * as schema from "./schema.server";',
      ],
      `drizzle(env.${camelCase(sqliteName)}, { schema })`,
    );

    writeFileSync(join(process.cwd(), "app/database.server.ts"), databaseFile);

    log(
      c.dim("You'll need to create a schema file in your app directory."),
      c.dim("See more at https://orm.drizzle.team/docs/sql-schema-declaration"),
    );

    step(
      `Created  SQLite database accessible via \`${c.dim(`context.${camelCase(sqliteName)}`)}\``,
    );

    warn(
      dedent`
      Add \`${orange("database")}\` from \`${orange("app/database.context.ts")}\` to your entrypoint defined in \`${orange("app/entry.server.ts")}\`
      See more at ${orange("https://orange-js.dev/docs/context")}
      `.trim(),
    );
  } else {
    step(
      `Created SQLite database accessible via \`${c.dim(
        `env.${camelCase(sqliteName)}`,
      )}\``,
    );
  }
}

async function existingDatabaseNames(client: Cloudflare, accountId: string) {
  const names: string[] = [];
  let existingDatabases = await client.d1.database.list({
    account_id: accountId,
    per_page: 100,
  });

  names.push(
    ...existingDatabases.result
      .map((db) => db.name?.toLowerCase())
      .filter((name) => name !== undefined),
  );

  while (existingDatabases.result.length === 100) {
    existingDatabases = await client.d1.database.list({
      account_id: accountId,
      per_page: 100,
      page: existingDatabases.result.length / 100 + 1,
    });

    names.push(
      ...existingDatabases.result
        .map((db) => db.name?.toLowerCase())
        .filter((name) => name !== undefined),
    );
  }

  return names;
}

function databaseFileTemplate(
  databaseName: string,
  imports: string | string[],
  databaseExpr: string,
) {
  return dedent`
  import { env } from "cloudflare:workers";
  ${Array.isArray(imports) ? imports.join("\n") : imports}

  declare module "@orange-js/orange" {
    // Add the database to the context.
    interface Context extends ContextFrom<typeof database> {}
  }

  export async function database() {
    return {
      ${camelCase(databaseName)}: ${databaseExpr},
    };
  }
  `;
}
