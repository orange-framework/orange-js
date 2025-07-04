import { test, expect } from "./fixture/index";

test("hello world [dev]", async ({ page, dev }) => {
  const { port } = await dev();
  await page.goto(`http://localhost:${port}`);
  await expect(page.getByText("Hello World")).toBeVisible();
});

test("hello world [worker]", async ({ page, worker }) => {
  const { port } = await worker();
  await page.goto(`http://localhost:${port}`);
  await expect(page.getByText("Hello World")).toBeVisible();
});
