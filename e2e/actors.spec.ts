import { test, expect, wranglerJson } from "./fixture/index";

const baseFiles = {
  "wrangler.jsonc": wranglerJson({
    durable_objects: {
      bindings: [
        {
          name: "Test",
          class_name: "Test",
        },
      ],
    },
    migrations: [
      {
        tag: "v1",
        new_sqlite_classes: ["Test"],
      },
    ],
  }),
  "app/entry.server.tsx": `
    import { app } from "@orange-js/orange/server";
    import { Root } from "./root";

    export { Test } from "./routes/index.tsx";

    export default app(Root);
  `,
};

test.multi(
  "can call actor method",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByText("Hello from Actor")).toBeVisible();
  },
  {
    ...baseFiles,
    "app/routes/index.tsx": `
    import { Actor, getActor } from "@orange-js/actors";

    export class Test extends Actor<Env> {
      async load() {
        return {
          message: "Hello from Actor",
        };
      }
    }

    export default async function Home() {
      const stub = getActor(Test, "foo");
      const { message } = await stub.load();
      return <div>{message}</div>;
    }
    `,
  }
);

test.multi(
  "using actor component",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByText("Hello from Actor")).toBeVisible();
    await expect(page.getByText("id: foo")).toBeVisible();
  },
  {
    ...baseFiles,
    "app/routes/index.tsx": `
    import { Actor, getActor } from "@orange-js/actors";

    export class Test extends Actor<Env> {
      async Component() {
        return (
          <div>
            Hello from Actor
            id: {this.identifier}
          </div>
        );
      }
    }

    export default async function Home() {
      return <Test.Component actor={Test} name="foo" />;
    }
    `,
  }
);

test.multi(
  "actor as component",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}/?id=foo`);
    await expect(page.getByText("Hello from Actor")).toBeVisible();
    await expect(page.getByText("id: foo")).toBeVisible();
  },
  {
    ...baseFiles,
    "app/routes/index.tsx": `
    import { Actor, getActor } from "@orange-js/actors";

    export default class Test extends Actor<Env> {
      static nameFromRequest(request: Request) {
        const url = new URL(request.url);
        return url.searchParams.get("id") ?? "default";
      }

      async Component() {
        return (
          <div>
            Hello from Actor
            id: {this.identifier}
          </div>
        );
      }
    }
    `,
    "app/entry.server.tsx": `
    import { app } from "@orange-js/orange/server";
    import { Root } from "./root";

    export { default as Test } from "./routes/index.tsx";

    export default app(Root);
    `,
  }
);

test.multi(
  "multiplayer",
  async ({ page, port, browser }) => {
    const secondTab = await browser.newPage();
    await secondTab.goto(`http://localhost:${port}/`);
    await expect(secondTab.getByText("count: 0")).toBeVisible();

    await page.goto(`http://localhost:${port}/`);
    await expect(page.getByText("count: 0")).toBeVisible();

    // Increment and ensure both tabs update
    await page.click("button");

    await expect(secondTab.getByText("count: 1")).toBeVisible({
      timeout: 1000,
    });
    await expect(page.getByText("count: 1")).toBeVisible({
      timeout: 1000,
    });
  },
  {
    ...baseFiles,
    "app/routes/index.tsx": `
    import { Actor, getActor, Observed, Persist } from "@orange-js/actors";

    export class Test extends Actor<Env> {
      @Persist
      count = 0;

      async increment() {
        this.count++;
      }

      @Observed("count")
      async Component() {
        return (
          <div>
            count: {this.count}
          </div>
        );
      }
    }

    async function increment() {
      "use server";
      Test.get("foo")!.increment();
    }

    export default function Home() {
      return (
        <div>
          <Test.Component actor={Test} name="foo" />
          <button onClick={increment}>Increment</button>
        </div>
      );
    }
    `,
    "app/entry.server.tsx": `
    import { app } from "@orange-js/orange/server";
    import { Root } from "./root";

    export { Test } from "./routes/index.tsx";

    export default app(Root);
    `,
  }
);
