#!/usr/bin/env node
import { Command } from "commander";
import { typesCommand } from "./commands/types.js";

const program = new Command();

program
  .name("orange")
  .description("CLI for Orange.js projects")
  .version("0.1.0");

// Add the types subcommand
program.addCommand(typesCommand);

program.parse();
