import { test, expect } from "./fixture/index";

test.multi(
  "hono handler with React routing",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByText("Hello World")).toBeVisible();
  },
  {
    "app/routes/index.tsx.tsx": `
      export default async function Index() {
        return <div>Hello World</div>;
      }
    `,
    "app/entry.server.tsx": `
      import { Hono } from "hono";
      import { handler } from "@orange-js/orange/hono";
      import { Root } from "./root";  

      const app = new Hono();

      // Regular Hono route that should work alongside React
      app.get("/api/status", (c) => c.json({ status: "ok" }));

      // Use the handler to create middleware for React routing
      app.use("*", handler(Root));

      export default app;
    `,
  }
);

test.multi(
  "hono handler with regular API routing",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}/api/status`);
    await expect(page.getByText('{"status":"ok"}')).toBeVisible();
  },
  {
    "app/routes/index.tsx.tsx": `
      export default async function Index() {
        return <div>Hello World</div>;
      }
    `,
    "app/entry.server.tsx": `
      import { Hono } from "hono";
      import { handler } from "@orange-js/orange/hono";
      import { Root } from "./root";

      const app = new Hono();

      // Regular Hono route that should work alongside React
      app.get("/api/status", (c) => c.json({ status: "ok" }));

      // Use the handler to create middleware for React routing
      app.use("*", handler(Root));

      export default app;
    `,
  }
);

test.multi(
  "hono handler with multiple API routes",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}/api/health`);
    await expect(page.getByText('{"health":"good"}')).toBeVisible();

    await page.goto(`http://localhost:${port}/api/version`);
    await expect(page.getByText('{"version":"1.0.0"}')).toBeVisible();
  },
  {
    "app/routes/index.tsx.tsx": `
      export default async function Index() {
        return <div>Hello World</div>;
      }
    `,
    "app/entry.server.tsx": `
      import { Hono } from "hono";
      import { handler } from "@orange-js/orange/hono";
      import { Root } from "./root";

      const app = new Hono();

      // Multiple API routes
      app.get("/api/health", (c) => c.json({ health: "good" }));
      app.get("/api/version", (c) => c.json({ version: "1.0.0" }));

      // Use the handler to create middleware for React routing
      app.use("*", handler(Root));

      export default app;
    `,
  }
);

test.multi(
  "hono handler with POST route",
  async ({ page, port }) => {
    // Test POST endpoint using JavaScript fetch
    await page.goto(`http://localhost:${port}`);

    const response = await page.evaluate(async (port) => {
      const res = await fetch(`http://localhost:${port}/api/echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test" }),
      });
      return await res.json();
    }, port);

    expect(response).toEqual({ echo: "test" });
  },
  {
    "app/routes/index.tsx.tsx": `
      export default async function Index() {
        return <div>Hello World</div>;
      }
    `,
    "app/entry.server.tsx": `
      import { Hono } from "hono";
      import { handler } from "@orange-js/orange/hono";
      import { Root } from "./root";

      const app = new Hono();

      // POST route for testing
      app.post("/api/echo", async (c) => {
        const body = await c.req.json();
        return c.json({ echo: body.message });
      });

      // Use the handler to create middleware for React routing
      app.use("*", handler(Root));

      export default app;
    `,
  }
);

test.multi(
  "hono handler fallback to React routing",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}/about`);
    await expect(page.getByText("About Page")).toBeVisible();
  },
  {
    "app/routes/index.tsx.tsx": `
      export default async function Index() {
        return <div>Hello World</div>;
      }
    `,
    "app/routes/about.tsx": `
      export default function About() {
        return <div>About Page</div>;
      }
    `,
    "app/entry.server.tsx": `
      import { Hono } from "hono";
      import { handler } from "@orange-js/orange/hono";
      import { Root } from "./root";

      const app = new Hono();

      // API route should not interfere with React routing
      app.get("/api/info", (c) => c.json({ info: "available" }));

      // Use the handler to create middleware for React routing
      app.use("*", handler(Root));

      export default app;
    `,
  }
);

test.multi(
  "hono handler with variables",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}/variables`);
    await expect(page.getByText("foo bar")).toBeVisible();
  },
  {
    "app/routes/variables.tsx": `
      import { variables } from "@orange-js/orange/hono";

      export default async function Index() {
        const { test } = variables();
        return <pre>{JSON.stringify(test)}</pre>;
      }
    `,
    "app/entry.server.tsx": `
      import { Hono } from "hono";
      import { handler } from "@orange-js/orange/hono";
      import { Root } from "./root";

      const app = new Hono();

      // API route should not interfere with React routing
      app.get("/api/info", (c) => c.json({ info: "available" }));

      app.use("*", (c, next) => {
        c.set("test", "foo bar");
        return next();
      });

      // Use the handler to create middleware for React routing
      app.use("*", handler(Root));

      export default app;
    `,
  }
);
