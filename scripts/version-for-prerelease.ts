import * as fs from "node:fs";
import { execSync } from "node:child_process";

const pkgs = fs.readdirSync("./packages");
const commitHash = execSync("git rev-parse --short HEAD").toString().trim();

for (const pkg of pkgs) {
  const pkgPath = `./packages/${pkg}`;
  const pkgJsonPath = `${pkgPath}/package.json`;
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

  pkgJson.version = `0.0.0-${commitHash}`;

  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
}