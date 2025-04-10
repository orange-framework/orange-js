import c from "chalk";
import { Cloudflare } from "cloudflare";
import {
  unstable_readConfig as readWranglerConfig,
  experimental_patchConfig as patchConfig,
} from "wrangler";

import { assertNotCancelled, text } from "../../prompts.js";
import { loader, step } from "../../prompts.js";
import { camelCase } from "./index.js";
import { generateWranglerTypes } from "../types.js";

export async function provisionKv(client: Cloudflare, accountId: string) {
  const config = readWranglerConfig({});
  const existing = await loader(existingKvNames(client, accountId), {
    start: "Fetching existing KV namespaces...",
    success: (value) => `Found ${value.length} existing KV namespaces`,
    error: "Failed to fetch existing KV namespaces",
  });

  const kvName = await text({
    message: "Enter the name of the KV namespace",
    placeholder: "my-kv",
    validate(value) {
      if (value.length === 0) {
        return "KV name cannot be empty";
      }

      if (existing.includes(value.toLowerCase())) {
        return `KV ${value} already exists`;
      }
    },
  });
  assertNotCancelled(kvName);

  const kv = await loader(
    client.kv.namespaces.create({
      account_id: accountId,
      title: kvName,
    }),
    {
      start: "Creating KV namespace...",
      success: () => "KV namespace created",
      error: "Failed to create KV namespace",
    },
  );

  patchConfig(
    config.configPath!,
    {
      kv_namespaces: [{ binding: camelCase(kvName), id: kv.id }],
    },
    true,
  );

  await loader(generateWranglerTypes(), {
    start: "Generating Wrangler types...",
    success: () => "Generated Wrangler types",
    error: "Failed to generate Wrangler types",
  });

  step(
    `Created KV namespace accessible via \`${c.dim(
      `env.${camelCase(kvName)}`,
    )}\``,
  );
}

async function existingKvNames(client: Cloudflare, accountId: string) {
  const names: string[] = [];
  let existingKv = await client.kv.namespaces.list({
    account_id: accountId,
    per_page: 100,
  });

  names.push(
    ...existingKv.result
      .map((kv) => kv.title?.toLowerCase())
      .filter((name) => name !== undefined),
  );

  while (existingKv.result.length === 100) {
    existingKv = await client.kv.namespaces.list({
      account_id: accountId,
      per_page: 100,
      page: existingKv.result.length / 100 + 1,
    });

    names.push(
      ...existingKv.result
        .map((kv) => kv.title?.toLowerCase())
        .filter((name) => name !== undefined),
    );
  }

  return names;
}
