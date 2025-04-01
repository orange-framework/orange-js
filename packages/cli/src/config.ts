import { cwd } from "node:process";
import { tsImport } from "tsx/esm/api";
import { join } from "node:path";
import { UserConfig } from "vite";

export type Config = {
  /**
   * Glob patterns for API routes.
   * @default ["api*.{ts,js}"]
   */
  apiRoutePatterns?: string[];
};

export async function resolveConfig() {
  const path = join(cwd(), "vite.config.ts");
    const viteConfig: { default: UserConfig } = await tsImport(
      path,
      import.meta.url
    );
    const orangeSettingsPlugin =
      viteConfig.default.plugins
        ?.flatMap((p) => p)
        .find(
          (p) =>
            p !== null &&
            typeof p === "object" &&
            "name" in p &&
            p.name === "orange:settings"
        );

  if (!orangeSettingsPlugin) {
    throw new Error("orange:settings plugin not found");
  }

  if (!("orangeOptions" in orangeSettingsPlugin)) {
    throw new Error("orange:settings plugin does not have orangeOptions");
  }

  return orangeSettingsPlugin.orangeOptions as Config;
}
