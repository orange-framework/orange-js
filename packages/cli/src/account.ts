import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Cloudflare } from "cloudflare";

import { assertNotCancelled, select } from "./prompts.js";

export async function promptForAccount(client: Cloudflare): Promise<string> {
  if (existsSync("node_modules/.cache/orange/orange-account.json")) {
    const { accountId } = JSON.parse(
      readFileSync("node_modules/.cache/orange/orange-account.json", "utf-8"),
    );
    return accountId;
  }

  const accounts = await client.accounts.list({
    per_page: 100,
  });
  const account = await select({
    message: "Select an account",
    options: accounts.result.map((account) => ({
      title: account.name,
      value: account.id,
    })),
  });
  assertNotCancelled(account);

  mkdirSync("node_modules/.cache/orange", { recursive: true });
  writeFileSync(
    "node_modules/.cache/orange/orange-account.json",
    JSON.stringify({ accountId: account }, null, 2),
    "utf8"
  );

  return account;
}
