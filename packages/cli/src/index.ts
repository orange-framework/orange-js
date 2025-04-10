#!/usr/bin/env node
import { Cloudflare } from "cloudflare";
import { createCommand } from "@commander-js/extra-typings";

import { typesCommand } from "./commands/types.js";
import { provisionCommand } from "./commands/provision/index.js";
import { createToken } from "./cf-auth.js";

const token = await createToken();
const client = new Cloudflare({
  apiToken: token,
});

const program = createCommand();

program
  .name("orange")
  .description("CLI for Orange.js projects")
  .version("0.1.0");

// Add the types subcommand
program.addCommand(typesCommand);

// Add the provision subcommand
program.addCommand(provisionCommand(client));

program.parse();
