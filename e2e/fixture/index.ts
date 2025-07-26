import dedent from "dedent";
import getPort from "get-port";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { test as base, Browser, Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { Unstable_Config } from "wrangler";
import { stripVTControlCharacters } from "node:util";
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

  let output: { type: "stdout" | "stderr"; text: string }[] = [];

  commandProcess.stdout.on("data", (data) => {
    const text = new TextDecoder().decode(data);
    output.push({ type: "stdout", text });
  });
  commandProcess.stderr.on("data", (data) => {
    const text = new TextDecoder().decode(data);
    output.push({ type: "stderr", text });
  });

  if (waitForText) {
    let resolve: (_: unknown) => void;
    let reject: (_: unknown) => void;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    commandProcess.stdout.on("data", (data) => {
      const text = new TextDecoder().decode(data);
      if (text.includes(waitForText)) {
        resolve(undefined);
      }
    });

    commandProcess.on("close", (code, signal) => {
      if (code !== 0) {
        for (const { type, text } of output) {
          if (type === "stderr") {
            process.stderr.write(text);
          } else {
            process.stdout.write(text);
          }
        }
        reject(
          new Error(`Command closed with code ${code} and signal ${signal}`)
        );
      }
    });

    commandProcess.on("error", (err) => {
      reject(err);
    });

    await promise;
  }

  if (waitForExit) {
    let resolve: (_: unknown) => void;
    const promise = new Promise((res) => {
      resolve = res;
    });

    commandProcess.on("close", () => {
      resolve(undefined);
    });

    await promise;
  }

  return {
    kill: () => commandProcess.kill(),
    output: () => output.reduce((acc, { text }) => acc + text, ""),
  };
}

export type CreateServer<T = {}> = (
  files?: Files
) => Promise<{ port: number } & T>;

const orangeTest = base.extend<{
  dev: CreateServer<{
    addFile: (filePath: string, contents: string) => Promise<void>;
  }>;
  worker: CreateServer;
}>({
  dev: async ({}, use, testInfo) => {
    const tasks = new DisposeScope();

    await use(async (files) => {
      const fixtureDir = await create(files ?? {}, testInfo.title);
      tasks.register(() => fs.rm(fixtureDir, { force: true, recursive: true }));

      const port = await getPort();
      const devServer = await runCmd({
        cmd: "node_modules/.bin/vite",
        args: ["dev", "--port", port.toString()],
        cwd: fixtureDir,
        waitForText: `localhost:${port}`,
      });

      tasks.register(devServer.kill);
      tasks.register(() =>
        testInfo.attach("Vite dev server", { body: devServer.output() })
      );

      return {
        port,
        addFile: async (filePath: string, contents: string) => {
          fs.writeFile(path.join(fixtureDir, filePath), dedent(contents));
        },
      };
    });

    // TODO: prettier doesnt support using
    await tasks[Symbol.asyncDispose]();
  },
  worker: async ({}, use, testInfo) => {
    const tasks = new DisposeScope();

    await use(async (files) => {
      const fixtureDir = await create(files ?? {}, testInfo.title);
      tasks.register(() => fs.rm(fixtureDir, { force: true, recursive: true }));

      const build = await runCmd({
        cmd: "node_modules/.bin/vite",
        args: ["build"],
        cwd: fixtureDir,
        waitForExit: true,
      });
      build.kill();
      tasks.register(() =>
        testInfo.attach("Vite build", { body: build.output() })
      );

      const port = await getPort();
      const inspectorPort = await getPort();
      const server = await runCmd({
        cmd: "node_modules/.bin/wrangler",
        args: [
          "dev",
          "--port",
          port.toString(),
          "--inspector-port",
          inspectorPort.toString(),
        ],
        cwd: fixtureDir,
        waitForText: `localhost:${port}`,
      });

      tasks.register(server.kill);
      tasks.register(() =>
        testInfo.attach("Wrangler dev server", {
          body: stripVTControlCharacters(server.output()),
        })
      );
      return { port };
    });

    // TODO: prettier doesnt support using
    await tasks[Symbol.asyncDispose]();
  },
});

export const test = orangeTest as typeof orangeTest & {
  multi: typeof multitest;
  dev: typeof devtest;
};

test.multi = multitest;
test.dev = devtest;

function devtest(
  title: string,
  fn: (opts: {
    page: Page;
    port: number;
    addFile: (filePath: string, contents: string) => Promise<void>;
    browser: Browser;
  }) => Promise<void>,
  files: Files = {}
) {
  test(`${title} dev`, async ({ page, dev, browser }) => {
    const { port, addFile } = await dev(files);
    await fn({ page, port, addFile, browser });
  });
}

function multitest(
  title: string,
  fn: (opts: {
    page: Page;
    port: number;
    browser: Browser;
    isDev: boolean;
  }) => Promise<void>,
  files: Files = {}
) {
  test(`${title} dev`, async ({ page, dev, browser }) => {
    const { port } = await dev(files);
    await fn({ page, port, browser, isDev: true });
  });

  test(`${title} worker`, async ({ page, worker, browser }) => {
    const { port } = await worker(files);
    await fn({ page, port, browser, isDev: false });
  });
}

export * from "@playwright/test";

const baseConfig = {
  name: "basic",
  main: "./app/entry.server.tsx",
  compatibility_date: "2025-05-11",
  compatibility_flags: ["nodejs_compat"],
  assets: {
    directory: "./dist/client",
  },
  observability: {
    enabled: true,
  },
};

export function wranglerJson(config: Partial<Unstable_Config>) {
  return JSON.stringify(
    {
      ...baseConfig,
      ...config,
    },
    null,
    2
  );
}
