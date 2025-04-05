#!/usr/bin/env node
import { createCommand } from "@commander-js/extra-typings";
import { typesCommand } from "./commands/types.js";

const program = createCommand();

program
  .name("orange")
  .description("CLI for Orange.js projects")
  .version("0.1.0");

// Add the types subcommand
program.addCommand(typesCommand);

program.parse();
