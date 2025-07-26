import * as fs from "node:fs";

export function replace(path: string, replacements: Record<string, string>) {
  if (!fs.existsSync(path)) {
    return;
  }

  let contents = fs.readFileSync(path, "utf-8");

  for (const [key, value] of Object.entries(replacements)) {
    contents = contents.replaceAll(key, value);
  }

  fs.writeFileSync(path, contents);
}
