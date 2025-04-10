import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { log } from "./prompts.js";
import xdgAppPaths from "xdg-app-paths";
import { parse } from "toml";
import { promptForAccount } from "./account.js";
import Cloudflare from "cloudflare";

export function getAuthToken(): string {
  // @ts-ignore
  const wranglerPath: string = xdgAppPaths(".wrangler").config();
  if (!existsSync(wranglerPath)) {
    log(
      "Wrangler account not found",
      "Please run `wrangler login` to login to Wrangler",
    );
    process.exit(1);
  }

  const configPath = path.join(wranglerPath, `config/default.toml`);
  if (!existsSync(configPath)) {
    log(
      "Wrangler config not found",
      "Please run `wrangler login` to login to Wrangler",
    );
    process.exit(1);
  }

  const contents = readFileSync(configPath, "utf-8");
  const config = parse(contents);
  return config.oauth_token;
}

export async function readAccountId(client: Cloudflare) {
  if (!existsSync("node_modules/.cache/wrangler/wrangler-account.json")) {
    return await promptForAccount(client);
  }

  const config = readFileSync(
    "node_modules/.cache/wrangler/wrangler-account.json",
    "utf-8",
  );
  const json = JSON.parse(config);
  return json.account.id;
}
