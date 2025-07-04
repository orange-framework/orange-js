import dedent from "dedent";
import getPort from "get-port";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { test as base } from "@playwright/test";
import { spawn } from "node:child_process";
import { DisposeScope } from "./util";

export type Files = Record<string, string>;

export async function create(files: Files, name: string) {
  const root = path.join(__dirname, "../../");
  const fixtureDir = path.join(
    root,
    ".test-fixtures",
    name.replaceAll(" ", "-")
  );
  const templateDir = path.join(path.dirname(__dirname), "templates", "basic");

  await fs.rm(fixtureDir, { recursive: true, force: true }).catch(() => {});

  await fs.cp(templateDir, fixtureDir, {
    recursive: true,
  });

  const writes = Object.entries(files).map(([filePath, contents]) =>
    fs.writeFile(path.join(fixtureDir, filePath), dedent(contents))
  );

  await Promise.all(writes);

  return fixtureDir;
}

type RunCmdOpts = {
  cmd: string;
  args: string[];
  cwd: string;
  waitForText?: string;
  waitForExit?: boolean;
};

export async function runCmd({
  cmd,
  args,
  cwd,
  waitForText,
  waitForExit,
}: RunCmdOpts) {
  const commandProcess = spawn(cmd, args, {
    cwd,
    stdio: "pipe",
    env: {
      ...process.env,
      NO_COLOR: "true",
    },
  });

  if (waitForText) {
    let resolve: (_: unknown) => void;
    const promise = new Promise((res, rej) => {
      resolve = res;
    });

    commandProcess.stdout.on("data", (data) => {
      const text = new TextDecoder().decode(data);
      if (text.includes(waitForText)) {
        resolve(undefined);
      }
    });

    await promise;
  }

  if (waitForExit) {
    let resolve: (_: unknown) => void;
    const promise = new Promise((res, rej) => {
      resolve = res;
    });

    commandProcess.on("close", () => {
      resolve(undefined);
    });

    await promise;
  }

  return () => commandProcess.kill();
}

export type CreateServer = (files?: Files) => Promise<{ port: number }>;

export const test = base.extend<{ dev: CreateServer; worker: CreateServer }>({
  dev: async ({}, use, testInfo) => {
    const tasks = new DisposeScope();

    await use(async (files) => {
      const fixtureDir = await create(files ?? {}, testInfo.title);
      tasks.register(() => fs.rm(fixtureDir, { force: true, recursive: true }));

      const port = await getPort();
      const server = await runCmd({
        cmd: "node_modules/.bin/vite",
        args: ["dev", "--port", port.toString()],
        cwd: fixtureDir,
        waitForText: `localhost:${port}`,
      });

      tasks.register(server);

      return { port };
    });

    // TODO: prettier doesnt support using
    await tasks[Symbol.asyncDispose]();
  },
  worker: async ({}, use, testInfo) => {
    const tasks = new DisposeScope();

    await use(async (files) => {
      const fixtureDir = await create(files ?? {}, testInfo.title);
      tasks.register(() => fs.rm(fixtureDir, { force: true, recursive: true }));

      await runCmd({
        cmd: "node_modules/.bin/vite",
        args: ["build"],
        cwd: fixtureDir,
        waitForExit: true,
      });

      const port = await getPort();
      const server = await runCmd({
        cmd: "node_modules/.bin/wrangler",
        args: ["dev", "--port", port.toString()],
        cwd: fixtureDir,
        waitForText: `localhost:${port}`,
      });

      tasks.register(server);
      return { port };
    });

    // TODO: prettier doesnt support using
    await tasks[Symbol.asyncDispose]();
  },
});

export * from "@playwright/test";
