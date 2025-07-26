import { test, expect } from "./fixture/index";

test.dev("route reload", async ({ page, port, addFile }) => {
  await page.goto(`http://localhost:${port}`);
  await expect(page.getByText("Hello World")).toBeVisible();

  await addFile(
    "app/routes/bar.tsx",
    `
    export default function Bar() {
      return <div>Bar</div>;
    }
    `
  );

  await page.waitForTimeout(2000);

  await page.goto(`http://localhost:${port}/bar`, { timeout: 10000 });
  await expect(page.getByText("Bar")).toBeVisible();
});
