import { test, expect } from "./fixture/index";

test.multi(
  "api route",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}/api`);
    await expect(page.getByText("Hello World")).toBeVisible();
  },
  {
    // TODO(zebp): we don't support tsx files in api routes yet
    "app/routes/api.ts": `
      export default {
        async fetch(request: Request) {
          return new Response("Hello World");
        }
      }
    `,
  }
);

test.multi(
  "working to subpath works",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}/api/foo/bar/baz`);
    await expect(page.getByText("Hello World")).toBeVisible();
  },
  {
    // TODO(zebp): we don't support tsx files in api routes yet
    "app/routes/api.ts": `
      export default {
        async fetch(request: Request) {
          return new Response("Hello World");
        }
      }
    `,
  }
);

test.multi(
  "hono",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}/api`);
    await expect(page.getByText("Hello World")).toBeVisible();
  },
  {
    "app/routes/api.ts": `
      import { Hono } from "hono";

      const app = new Hono();

      app.get("/", (c) => c.text("Hello World"));

      export default app;
    `,
  }
);
