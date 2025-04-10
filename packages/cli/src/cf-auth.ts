import open from "open";
import xdgAppPaths from "xdg-app-paths";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import * as path from "node:path";

import { assertNotCancelled, password, step } from "./prompts.js";

// @ts-ignore
const orangePath: string = xdgAppPaths(".orange-cli").config();

if (!existsSync(orangePath)) {
  mkdirSync(orangePath, { recursive: true });
}

const permissionGroupKeys = [
  { key: "account", type: "read" },
  { key: "user", type: "read" },
  { key: "workers", type: "edit" },
  { key: "workers_kv", type: "edit" },
  { key: "workers_routes", type: "edit" },
  { key: "workers_scripts", type: "edit" },
  { key: "workers_tail", type: "read" },
  { key: "d1", type: "edit" },
  { key: "pages", type: "edit" },
  { key: "zone", type: "read" },
  { key: "ssl_certs", type: "edit" },
  { key: "ai", type: "edit" },
  { key: "queues", type: "edit" },
  { key: "pipelines", type: "edit" },
  { key: "workers_r2", type: "edit" },
  { key: "workers_kv_storage", type: "edit" },
  { key: "query_cache", type: "edit" },
  { key: "queues", type: "edit" },
  { key: "workers_ci", type: "edit" },
  { key: "ai", type: "edit" },
];

function createAPITokenURL() {
  const url = new URL("http://dash.cloudflare.com/profile/api-tokens");
  url.searchParams.set("accountId", "*");
  url.searchParams.set("zoneId", "all");
  url.searchParams.set(
    "permissionGroupKeys",
    JSON.stringify(permissionGroupKeys),
  );
  url.searchParams.set("name", "Orange CLI");
  return url.toString();
}

export async function createToken() {
  const existingToken = loadToken();
  if (existingToken) {
    return existingToken;
  }

  const url = createAPITokenURL();
  step(
    "Opening the browser to create an API token, create the token and then paste it below...",
  );

  await open(url);

  const token = await password({
    message: "Enter the token",
    placeholder: "Press Contiue to Summary -> Create Token",
  });

  assertNotCancelled(token);
  saveToken(token);

  return token;
}

function saveToken(token: string) {
  writeFileSync(
    path.join(orangePath, "orange.json"),
    JSON.stringify({ token }),
  );
}

function loadToken(): string | undefined {
  try {
    const token = readFileSync(path.join(orangePath, "orange.json"), "utf-8");
    return JSON.parse(token).token;
  } catch (error) {
    return undefined;
  }
}
