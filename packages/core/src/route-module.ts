import type { FC } from "react";
import type { CloudflareEnv, Context } from "./index.js";

import type * as RR from "react-router/route-module";

type ReturnTypeOf<
  T extends RouteModule,
  Key extends keyof T
> = T[Key] extends Func ? Awaited<ReturnType<T[Key]>> : never;

type BaseServerArgs<T extends RouteInfo> = {
  params: T["params"];
  context: Context;
  request: Request;
  env: CloudflareEnv;
};

type BaseClientArgs<T extends RouteInfo> = {
  params: T["params"];
  request: Request;
  env: CloudflareEnv;
};

type Func = (...args: any[]) => any;

type RouteModule = {
  meta?: Func;
  links?: Func;
  headers?: Func;
  loader?: Func;
  clientLoader?: Func;
  action?: Func;
  clientAction?: Func;
  HydrateFallback?: unknown;
  default?: unknown;
  ErrorBoundary?: unknown;
  [key: string]: unknown;
};

type RouteInfo = {
  parents: RouteInfo[];
  module: RouteModule;
  id: unknown;
  file: string;
  path: string;
  params: unknown;
  loaderData: unknown;
  actionData: unknown;
};

export type {
  CreateLoaderData,
  CreateActionData,
} from "react-router/route-module";

export type LinkDescriptors = RR.LinkDescriptors;
export type LinksFunction = () => LinkDescriptors;

export type MetaArgs<T extends RouteInfo> = RR.CreateMetaArgs<T>;
export type MetaDescriptors = RR.MetaDescriptors;

export type HeadersArgs = RR.HeadersArgs;
export type HeadersFunction = (args: HeadersArgs) => Headers | HeadersInit;

export type LoaderData<T extends RouteInfo> = RR.CreateLoaderData<T>;
export type LoaderArgs<T extends RouteInfo> = BaseServerArgs<T>;
export type ClientLoaderArgs<T extends RouteInfo> = BaseClientArgs<T> & {
  serverLoader: () => Promise<ReturnTypeOf<T["module"], "loader">>;
};

export type ActionData<T extends RouteInfo> = RR.CreateActionData<T>;
export type ActionArgs<T extends RouteInfo> = BaseServerArgs<T>;
export type ClientActionArgs<T extends RouteInfo> = BaseClientArgs<T> & {
  serverAction: () => Promise<ReturnTypeOf<T["module"], "action">>;
};

export type Component<T extends RouteInfo> = FC<ComponentProps<T>>;
export type ComponentProps<T extends RouteInfo> = RR.CreateComponentProps<T>;
export type ErrorBoundaryProps<T extends RouteInfo> =
  RR.CreateErrorBoundaryProps<T>;
export type HydrateFallbackProps<T extends RouteInfo> =
  RR.CreateHydrateFallbackProps<T>;
