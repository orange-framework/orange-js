import dedent from "dedent";
import c from "chalk";
import { Cloudflare } from "cloudflare";
import {
  unstable_readConfig as readWranglerConfig,
  experimental_patchConfig as patchConfig,
} from "wrangler";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { match } from "ts-pattern";
import { detect } from "detect-package-manager";

import {
  loader,
  password,
  text,
  assertNotCancelled,
  step,
  confirm,
  select,
  orange,
  log,
  warn,
} from "../../prompts.js";
import { exec } from "../../exec.js";
import { generateWranglerTypes } from "../types.js";
import {
  camelCase,
  installedNodeModules,
  isDrizzleInstalled,
} from "./index.js";

export async function provisionPostgres(client: Cloudflare, accountId: string) {
  const config = readWranglerConfig({});
  const hyperdriveDatbases = await loader(
    client.hyperdrive.configs.list({
      account_id: accountId,
    }),
    {
      start: "Fetching existing databases...",
      success: (value) => `Found ${value.result.length} existing databases`,
      error: "Failed to fetch existing databases",
    },
  );

  const existingDatabases = hyperdriveDatbases.result.map((db) => db.name);

  const databaseName = await text({
    message: "Enter the name of the database",
    placeholder: "my-database",
    validate(value) {
      if (value.length === 0) {
        return "Database name cannot be empty";
      }

      if (existingDatabases.includes(value)) {
        return `Database ${value} already exists`;
      }
    },
  });
  assertNotCancelled(databaseName);

  const connectionString = await password({
    message: "Enter the connection URL for the database",
    placeholder: "postgres://user:password@host:6542/database",
    mask: "*",
    validate(value) {
      try {
        const url = new URL(value);
        if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
          return "Invalid connection URL";
        }
      } catch (error) {
        return `${error}`;
      }
    },
  });
  assertNotCancelled(connectionString);

  const localConnectionString = await password({
    message:
      "Optionally, enter the connection URL use for local development.\nLeave blank to use the remote database.",
    placeholder: "postgres://user:password@host:6542/database",
    mask: "*",
    validate(value) {
      if (value.length === 0) {
        return;
      }

      try {
        const url = new URL(value);
        if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
          return "Invalid connection URL";
        }
      } catch (error) {
        return "Invalid connection URL";
      }
    },
  });
  assertNotCancelled(localConnectionString);

  const caching = await confirm({
    message: "Do you want to enable caching for this database?",
  });
  assertNotCancelled(caching);

  const url = new URL(connectionString);
  const database = url.pathname.slice(1);
  const username = url.username;
  const dbPassword = url.password;
  const host = url.hostname;
  const port = url.port;

  const result = await loader(
    client.hyperdrive.configs.create({
      account_id: accountId,
      name: databaseName,
      origin: {
        host,
        port: port ? parseInt(port) : 5432,
        user: username,
        password: dbPassword,
        database,
        scheme: "postgres",
      },
      caching: {
        disabled: !caching,
      },
    }),
    {
      start: "Provisioning database...",
      success: (value) =>
        `Database ${databaseName} provisioned as ${orange(value.id)}`,
      error: "Failed to provision database",
    },
  );

  patchConfig(
    config.configPath!,
    {
      hyperdrive: [
        {
          binding: camelCase(databaseName),
          id: result.id,
          localConnectionString: localConnectionString || undefined,
        },
      ],
    },
    true,
  );

  const createClient = await confirm({
    message:
      "Do you want to create a Postgres client accessible in your loaders?",
  });
  assertNotCancelled(createClient);

  if (createClient) {
    const client = await determineClient();
    const template = match(client)
      .with("pg", () =>
        connectFileTemplate(
          databaseName,
          'import { Client } from "pg";',
          `new Client(env.${camelCase(databaseName)}.connectionString)`,
        ),
      )
      .with("postgres", () =>
        connectFileTemplate(
          databaseName,
          'import postgres from "postgres";',
          `postgres(env.${camelCase(databaseName)}.connectionString)`,
        ),
      )
      .with("drizzle-orm-pg", () =>
        connectFileTemplate(
          databaseName,
          [
            'import { drizzle } from "drizzle-orm/node-postgres";',
            'import * as schema from "./schema.server";',
          ],
          `drizzle(env.${camelCase(databaseName)}.connectionString, { schema })`,
        ),
      )
      .with("drizzle-orm-postgres", () =>
        connectFileTemplate(
          databaseName,
          [
            'import { drizzle } from "drizzle-orm/postgres-js";',
            'import * as schema from "./schema.server";',
          ],
          `drizzle(env.${camelCase(databaseName)}.connectionString, { schema })`,
        ),
      )
      .exhaustive();

    if (client.includes("drizzle")) {
      log(c.dim("You'll need to create a schema file in your app directory."));
    }

    writeFileSync(join(process.cwd(), "app/database.server.ts"), template);
  }

  await loader(generateWranglerTypes(), {
    start: "Generating Wrangler types...",
    success: () => "Generated Wrangler types",
    error: "Failed to generate Wrangler types",
  });

  step(
    `Created connection to postgres accessible via \`${c.dim(
      `env.${camelCase(databaseName)}`,
    )}\` and \`${c.dim(`context.${camelCase(databaseName)}`)}\``,
  );

  warn(
    dedent`
    Add \`${orange("connect")}\` from \`${orange(
      "app/database.context.ts",
    )}\` to your entrypoint defined in \`${orange("app/entry.server.tsx")}\`
    See more at ${orange("https://orange-js.dev/docs/context")}
    `.trim(),
  );
}

const postgresClients = ["pg", "postgres"] as const;

function installedPostgresClient() {
  const installed = installedNodeModules();
  return postgresClients.find((client) => installed.includes(client));
}

async function determineClient(): Promise<
  "pg" | "postgres" | "drizzle-orm-pg" | "drizzle-orm-postgres"
> {
  const installed = installedPostgresClient();
  if (installed !== undefined) {
    if (isDrizzleInstalled()) {
      return installed === "pg" ? "drizzle-orm-pg" : "drizzle-orm-postgres";
    }
    return installed;
  }

  const client = await select({
    message: "Select a Postgres library to install",
    options: [
      { title: "pg", value: "pg" },
      { title: "postgres", value: "postgres" },
      { title: "Drizzle via pg", value: "drizzle-orm-pg" },
      { title: "Drizzle via postgres", value: "drizzle-orm-postgres" },
    ],
  });
  assertNotCancelled(client);

  const packages = match(client)
    .with("pg", () => ["pg"])
    .with("postgres", () => ["postgres"])
    .with("drizzle-orm-pg", () => ["drizzle-orm", "pg"])
    .with("drizzle-orm-postgres", () => ["drizzle-orm", "postgres"])
    .run();

  await loader(installPackages(packages), {
    start: `Installing ${packages.join(", ")}...`,
    success: () => "Installed",
    error: "Failed to install Postgres library",
  });

  return client as
    | "pg"
    | "postgres"
    | "drizzle-orm-pg"
    | "drizzle-orm-postgres";
}

function connectFileTemplate(
  databaseName: string,
  imports: string | string[],
  databaseExpr: string,
) {
  return dedent`
  import { env } from "cloudflare:workers";
  ${Array.isArray(imports) ? imports.join("\n") : imports}

  declare module "@orange-js/orange" {
    // Add the database to the context.
    interface Context extends ContextFrom<typeof connect> {}
  }

  export async function connect() {
    return {
      ${camelCase(databaseName)}: ${databaseExpr},
    };
  }
  `;
}

async function installPackages(packages: string[]) {
  const pm = await detect();
  const command = match(pm)
    .with("npm", () => ["install", ...packages])
    .with("yarn", () => ["add", ...packages])
    .with("pnpm", () => ["add", ...packages])
    .with("bun", () => ["add", ...packages])
    .exhaustive();

  await exec(pm, command);
}
