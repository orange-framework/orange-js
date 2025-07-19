// Adapted from:
// https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-rsc/examples/starter-cf-single/src/framework/entry.rsc.tsx

import * as React from "react";
import * as ReactServer from "@vitejs/plugin-rsc/rsc";
import type { ReactFormState } from "react-dom/client";
import type { ErrorInfo } from "react";
import { router } from "./router.js";

import { ReactComponent, routes } from "virtual:orange/routes";
import { ReactActor } from "./actor.js";
import { env } from "cloudflare:workers";
import { CloudflareEnv } from "./index.js";
import { internalContext } from "./internal-context.js";

export interface Context {
  cloudflare: {
    env: CloudflareEnv;
    ctx: ExecutionContext;
  };
}

export type AppOptions = {
  context?: (
    env: CloudflareEnv
  ) => Omit<Context, "cloudflare"> | Promise<Omit<Context, "cloudflare">>;
};

export type RscPayload = {
  root: React.ReactNode;
  returnValue?: unknown;
  formState?: ReactFormState;
};

type Layout = (props: { children: React.ReactNode }) => React.ReactNode;

export async function request() {
  const request = internalContext.getStore()?.request;
  if (!request) {
    throw new Error("Not within request context");
  }

  return request;
}

async function handler(
  request: Request,
  Layout: Layout
): Promise<Response | undefined> {
  const isAction = request.method === "POST";
  let returnValue: unknown | undefined;
  let formState: ReactFormState | undefined;
  let temporaryReferences: unknown | undefined;

  if (isAction) {
    // x-rsc-action header exists when action is called via `ReactClient.setServerCallback`.
    const actionId = request.headers.get("x-rsc-action");
    if (actionId) {
      const contentType = request.headers.get("content-type");
      const body = contentType?.startsWith("multipart/form-data")
        ? await request.formData()
        : await request.text();
      temporaryReferences = ReactServer.createTemporaryReferenceSet();
      const args = await ReactServer.decodeReply(body, { temporaryReferences });
      const action = await ReactServer.loadServerAction(actionId);
      returnValue = await action.apply(null, args);
    } else {
      // otherwise server function is called via `<form action={...}>`
      // before hydration (e.g. when javascript is disabled).
      // aka progressive enhancement.
      const formData = await request.formData();
      const decodedAction = await ReactServer.decodeAction(formData);
      const result = await decodedAction();
      formState = await ReactServer.decodeFormState(result, formData);
    }
  }

  const route = router(routes)(request);
  if (!route) {
    return undefined;
  }

  const match = route.pattern.exec(request.url);
  const params = match?.pathname.groups ?? {};

  return await internalContext.run({ request, params }, async () => {
    const { default: maybeComponent } = route.module;
    let Component: (props: {
      request: Request;
      params: Record<string, string>;
    }) => React.ReactNode | Promise<React.ReactNode>;

    if (isReactActor(maybeComponent)) {
      const name = maybeComponent.nameFromRequest(request);
      Component = () => (
        // @ts-ignore
        <maybeComponent.Component durableObject={env.HomeActor} name={name} />
      );
    } else {
      Component = maybeComponent;
    }

    return await rscResponse({
      root: (
        <Layout>
          <Component request={request} params={params} />
        </Layout>
      ),
      request,
      returnValue,
      formState,
    });
  });
}

type RscResponseOptions = {
  root: React.ReactNode;
  request: Request;
  returnValue?: unknown;
  formState?: ReactFormState;
};

async function rscResponse({
  root,
  request,
  returnValue,
  formState,
}: RscResponseOptions) {
  const rscStream = ReactServer.renderToReadableStream<RscPayload>(
    {
      // in this example, we always render the same `<Root />`
      root,
      returnValue,
      formState,
    },
    {
      onError(error: unknown, errorInfo: ErrorInfo) {
        console.error("Error during RSC streaming", error, errorInfo);
      },
    }
  );

  const url = new URL(request.url);
  const isRscRequest =
    (!request.headers.get("accept")?.includes("text/html") &&
      !url.searchParams.has("__html")) ||
    url.searchParams.has("__rsc");

  if (isRscRequest) {
    return new Response(rscStream, {
      headers: {
        "content-type": "text/x-component;charset=utf-8",
        vary: "accept",
      },
    });
  }

  const { renderHTML } = await import.meta.viteRsc.loadModule<
    typeof import("./ssr.js")
  >("ssr", "index");

  const htmlStream = await renderHTML(rscStream, {
    formState,
    // allow quick simulation of javscript disabled browser
    debugNojs: url.searchParams.has("__nojs"),
    onError(error: unknown, errorInfo: ErrorInfo) {
      console.error("Error during RSC serialization", error, errorInfo);
    },
  });

  return new Response(htmlStream, {
    headers: {
      "Content-type": "text/html",
      vary: "accept",
    },
  });
}

import.meta.hot?.accept();

export function app(Layout: Layout, options?: AppOptions) {
  return {
    async fetch(request: Request) {
      try {
        return (
          (await handler(request, Layout)) ??
          new Response("Not found", { status: 404 })
        );
      } catch (error) {
        return new Response("Error", { status: 500 });
      }
    },
  };
}

function isReactActor(
  maybeComponent: ReactComponent | typeof ReactActor<unknown>
): maybeComponent is typeof ReactActor<unknown> {
  return (
    typeof maybeComponent === "function" &&
    Object.getPrototypeOf(maybeComponent) === ReactActor
  );
}
