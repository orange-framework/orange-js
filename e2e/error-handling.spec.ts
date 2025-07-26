import { test, expect } from "./fixture/index";

test.multi(
  "immediate error handling with default error handler",
  async ({ page, port, isDev }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByText("Something went wrong")).toBeVisible();
    if (isDev) {
      await expect(page.getByText("Hello World")).toBeVisible();
    }
  },
  {
    "app/routes/index.tsx": `
      export default function Index() {
        throw new Error("Hello World");
      }
    `,
  }
);

test.multi(
  "delayed error handling with default error handler",
  async ({ page, port, isDev }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByText("Something went wrong")).toBeVisible();
    if (isDev) {
      await expect(page.getByText("Hello World")).toBeVisible();
    }
  },
  {
    "app/routes/index.tsx": `
      import { Suspense } from "react";

      async function Err() {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        throw new Error("Hello World");
      }

      export default function Index() {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <Err />
          </Suspense>
        );
      }
    `,
  }
);
