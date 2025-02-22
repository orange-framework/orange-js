import { Plugin } from "vite";
import { VirtualModule } from "../virtual-module.js";
import { Context } from "../index.js";
import { devAssets } from "../assets.js";

export const browserManifestVirtualModule = new VirtualModule("dev-manifest");

export function devManifestPlugin(ctx: Context): Plugin {
  return {
    name: "orange:dev-manifest",
    resolveId(source, importer, options) {
      if (browserManifestVirtualModule.is(source)) {
        return browserManifestVirtualModule.id;
      }
    },
    load(id) {
      if (!browserManifestVirtualModule.is(id)) {
        return;
      }

      const manifest = devAssets(ctx);
      return `window.__reactRouterManifest=${JSON.stringify(manifest)};`;
    },
  }
}