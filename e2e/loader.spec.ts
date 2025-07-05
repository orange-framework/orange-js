import { test, expect } from "./fixture/index";

const route = (loader: string) => `
import { useLoaderData } from "@orange-js/orange";

${loader};

export default function Index() {
  const loaderData = useLoaderData();
  return <div>{JSON.stringify(loaderData)}</div>;
}
`;

test.multi(
  "loader",
  async ({ page, port }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByText("foo bar")).toBeVisible();
  },
  {
    "app/routes/_index.tsx": route(`
      export async function loader() {
        return {
          test: "foo bar",
        };
      }
    `),
  }
);
