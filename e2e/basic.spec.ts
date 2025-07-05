import { test, expect } from "./fixture/index";

test.multi("hello world", async ({ page, port }) => {
  await page.goto(`http://localhost:${port}`);
  await expect(page.getByText("Hello World")).toBeVisible();
});
