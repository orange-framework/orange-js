import { test, expect } from "./fixture/index";

test.multi("hello world", async ({ page, port }) => {
  await page.goto(`http://localhost:${port}`);
  await expect(page.getByText("Hello World")).toBeVisible();
});

test.multi(
  ".browser files arent treated as routes",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}/index.browser`);
    await expect(page.getByText("Not found")).toBeVisible();
  },
  {
    "app/routes/index.browser.tsx": `
      export default function Index() {
        return <div>Hello World</div>;
      }
    `,
  }
);
