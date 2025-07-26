declare module "virtual:orange/entrypoints" {}

declare module "virtual:orange/client-manifest" {}

declare module "virtual:orange/routes" {
  import type * as React from "react";

  type ReactComponent = (props: {
    request: Request;
    params: Record<string, string>;
  }) => React.ReactNode | Promise<React.ReactNode>;

  type Module = {
    default: ReactComponent | typeof import("./actor.tsx").ReactActor<unknown>;
  };

  export const routes: {
    pattern: URLPattern;
    module: Module;
  }[];
}
