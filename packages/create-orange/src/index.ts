#!/usr/bin/env node
import commandExists from "command-exists";
import whichPm from "which-pm-runs";
import { input, confirm } from "@inquirer/prompts";
import { rmSync } from "node:fs";
import { replace } from "./replace.js";
import { command } from "./command.js";
import { execSync } from "node:child_process";

async function main() {
  const gitExists = await commandExists("git");
  if (!gitExists) {
    console.error("git is not installed");
    process.exit(1);
  }

  const name = await input({
    message: "What do you want to name your project?",
    default: process.argv[2],
    validate: (value) => value.length > 0,
  });

  const branch = process.argv[3] ?? "main";

  await command(
    {
      message: "Cloning template...",
      bin: "git",
      args: [
        "clone",
        "https://github.com/zebp/orange-template.git",
        name,
        "--depth",
        "1",
        "--branch",
        branch,
      ],
    },
    { clearPromptOnDone: true }
  );

  const replacements = {
    "orange-template": name,
  };

  rmSync(`${name}/.git`, { recursive: true, force: true });
  replace(`${name}/package.json`, replacements);
  replace(`${name}/wrangler.jsonc`, replacements);
  replace(`${name}/README.md`, replacements);

  const doInstallDeps = await confirm({
    message: "Do you want to install dependencies?",
  });

  const pm = whichPm() ?? { name: "npm" };
  if (doInstallDeps) {
    await command(
      {
        message: "Installing dependencies...",
        bin: pm.name,
        args: ["install"],
        cwd: name,
      },
      { clearPromptOnDone: true }
    );
  }

  if (
    await confirm({ message: "Do you want to initialize a git repository?" })
  ) {
    await command(
      {
        message: "Initializing git repository...",
        bin: "git",
        args: ["init"],
        cwd: name,
      },
      { clearPromptOnDone: true }
    );

    execSync("git add .", { cwd: name });

    await command(
      {
        message: "Creating initial commit...",
        bin: "git",
        args: ["commit", "-m", "Initial commit"],
        cwd: name,
      },
      { clearPromptOnDone: true }
    );
  }

  console.log(`
\n\n
  🍊 Change directories: cd ${name}
     Start dev server: ${pm.name} run dev
     Deploy: ${pm.name} run deploy
\n\n
`);
}

main();
