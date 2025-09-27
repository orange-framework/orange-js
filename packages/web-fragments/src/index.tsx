import React from "react";
import { app as orangeApp } from "@orange-js/orange/server";
import { routes } from "virtual:orange/routes";
import {
  renderToReadableStream,
  renderServerComponentStreamToHtmlReadableStream,
} from "@orange-js/orange/rsc";

export const app: typeof orangeApp = (Layout, options) => {
  const { fetch } = orangeApp(Layout, options);
  return {
    fetch: async (request: Request) => {
      if (request.url.includes("/__web-fragments")) {
        if ("__webFragmentsHandler" in globalThis) {
          // @ts-ignore
          return await globalThis.__webFragmentsHandler(request);
        }

        const fallbacks: Record<string, string> = {};

        for (const route of routes) {
          if ("FragmentFallback" in route.module) {
            const stream = renderToReadableStream({
              root: (
                <Layout>
                  {/* @ts-ignore */}
                  <route.module.FragmentFallback />
                </Layout>
              ),
            });

            const htmlStream =
              await renderServerComponentStreamToHtmlReadableStream(stream);
            const html = await new Response(htmlStream).text();

            fallbacks[route.pattern.pathname] = html;
          }
        }

        return Response.json(fallbacks);
      }

      return await fetch(request);
    },
  };
};
