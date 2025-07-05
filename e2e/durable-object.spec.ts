import { test, multitest, expect, wranglerJson } from "./fixture/index";

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
};

const mainRoute = `
import { RouteDurableObject, useDurableObject, Form } from "@orange-js/orange";

export default function Home({}: Route.ComponentProps) {
  const { message } = useDurableObject<Test>();

  return (
    <div className="w-screen h-screen flex flex-col justify-center items-center gap-10">
      <h1 className="text-6xl font-bold text-center">{message}</h1>
      <Form method="post" navigate={false}>
        <button type="submit" id="button" className="bg-blue-500 text-white p-2 rounded-md">
          Update
        </button>
      </Form>
    </div>
  );
}
`;

test.describe("durable object", () => {
  multitest(
    "loader",
    async ({ page, port }) => {
      await page.goto(`http://localhost:${port}`);
      await expect(page.getByText("Hello Durable Object")).toBeVisible();
    },
    {
      ...baseFiles,
      "app/routes/_index.tsx": `
      ${mainRoute}
      export class Test extends RouteDurableObject<Env> {
        async loader() {
          return {
            message: "Hello Durable Object",
          };
        }

        static async id() {
          return "foo";
        }
      }`,
    }
  );

  multitest(
    "loader with static id",
    async ({ page, port }) => {
      await page.goto(`http://localhost:${port}`);
      await expect(page.getByText("Hello Durable Object")).toBeVisible();
    },
    {
      ...baseFiles,
      "app/routes/_index.tsx": `
      ${mainRoute}
      export class Test extends RouteDurableObject<Env> {
        async loader() {
          return {
            message: "Hello Durable Object",
          };
        }

        static id = "foo";
      }`,
    }
  );

  multitest(
    "loader with dynamic id",
    async ({ page, port }) => {
      await page.goto(`http://localhost:${port}/test/foo`);
      await expect(page.getByText("Hello foo")).toBeVisible();
    },
    {
      ...baseFiles,
      "app/routes/test.$test.tsx": `
      ${mainRoute}

      export class Test extends RouteDurableObject<Env> {
        async loader({ params }) {
          return {
            message: \`Hello \${params.test}\`,
          };
        }

        static async id({ params }) {
          return params.test;
        }
      }`,
    }
  );

  multitest(
    "action",
    async ({ page, port }) => {
      await page.goto(`http://localhost:${port}`);
      await expect(page.getByText("Hello Durable Object")).toBeVisible();
      await page.click("#button");
      await expect(page.getByText("Updated")).toBeVisible();
    },
    {
      ...baseFiles,
      "app/routes/_index.tsx": `
      ${mainRoute}
      export class Test extends RouteDurableObject<Env> {
        async loader() {
          const message = await this.ctx.storage.get("message");
          return {
            message: message ?? "Hello Durable Object",
          };
        }

        async action() {
          this.ctx.storage.put("message", "Updated");
        }

        static id = "foo";
      }`,
    }
  );
});
