declare module "virtual:orange/entrypoints" {}

declare module "virtual:orange/client-manifest" {}

declare module "virtual:orange/server-bundle" {
  import type { ServerBuild } from "react-router";

  export const assets: ServerBuild["assets"];
  export const assetsBuildDirectory: ServerBuild["assetsBuildDirectory"];
  export const basename: ServerBuild["basename"];
  export const entry: ServerBuild["entry"];
  export const future: ServerBuild["future"];
  export const isSpaMode: ServerBuild["isSpaMode"];
  export const publicPath: ServerBuild["publicPath"];
  export const routes: ServerBuild["routes"];
  export const apiRoutes: Record<
    string,
    {
      default: {
        fetch: (
          request: Request,
          env: unknown,
          ctx: ExecutionContext,
        ) => Promise<Response>;
      };
    }
  >;
  export const prerender: string[];
  export const ssr: true;
  export const routeDiscovery: ServerBuild["routeDiscovery"];
}
