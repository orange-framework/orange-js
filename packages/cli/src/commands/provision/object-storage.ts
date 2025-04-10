import c from "chalk";
import { Cloudflare } from "cloudflare";
import {
  unstable_readConfig as readWranglerConfig,
  experimental_patchConfig as patchConfig,
} from "wrangler";

import {
  assertNotCancelled,
  loader,
  select,
  step,
  text,
} from "../../prompts.js";
import { camelCase } from "./index.js";
import { generateWranglerTypes } from "../types.js";
export async function provisionBucket(client: Cloudflare, accountId: string) {
  const config = readWranglerConfig({});
  const existing = await loader(existingBucketNames(client, accountId), {
    start: "Fetching existing buckets...",
    success: (value) => `Found ${value.length} existing buckets`,
    error: "Failed to fetch existing buckets",
  });

  const bucketName = await text({
    message: "Enter the name of the bucket",
    placeholder: "my-bucket",
    validate(value) {
      if (existing.includes(value.toLowerCase())) {
        return `Bucket ${value} already exists`;
      }
    },
  });
  assertNotCancelled(bucketName);

  const jurisdiction = await select<undefined | "eu" | "fedramp">({
    message: "Select the jurisdiction of the bucket",
    options: [
      { title: "Automatic", value: undefined },
      { title: "EU", value: "eu" },
      { title: "FedRAMP", value: "fedramp" },
    ],
  });
  assertNotCancelled(jurisdiction);

  const bucket = await loader(
    client.r2.buckets.create({
      account_id: accountId,
      name: bucketName,
      jurisdiction,
    }),
    {
      start: "Creating bucket...",
      success: () => "Bucket created",
      error: "Failed to create bucket",
    },
  );

  patchConfig(
    config.configPath!,
    {
      r2_buckets: [
        {
          binding: camelCase(bucketName),
          bucket_name: bucketName,
          jurisdiction,
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

  step(
    `Created R2 bucket accessible via \`${c.dim(
      `env.${camelCase(bucketName)}`,
    )}\``,
  );
}

async function existingBucketNames(client: Cloudflare, accountId: string) {
  const names: string[] = [];
  let existingBuckets = await client.r2.buckets.list({
    account_id: accountId,
    per_page: 100,
  });

  const buckets = existingBuckets.buckets
    ?.map((bucket) => bucket.name?.toLowerCase())
    ?.filter((name) => name !== undefined);

  names.push(...(buckets ?? []));

  while (existingBuckets.buckets?.length === 100) {
    existingBuckets = await client.r2.buckets.list({
      account_id: accountId,
      per_page: 100,
      cursor: existingBuckets.buckets[existingBuckets.buckets.length - 1].name,
    });

    const buckets = existingBuckets.buckets
      ?.map((bucket) => bucket.name?.toLowerCase())
      ?.filter((name) => name !== undefined);

    names.push(...(buckets ?? []));
  }

  return names;
}
