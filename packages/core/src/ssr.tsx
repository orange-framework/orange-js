// Adapted from:
// https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-rsc/examples/starter-cf-single/src/framework/entry.ssr.tsx

import React, { ErrorInfo } from "react";
import { injectRscStreamToHtml } from "@vitejs/plugin-rsc/rsc-html-stream/ssr";
import type { ReactFormState } from "react-dom/client";
import * as ReactClient from "@vitejs/plugin-rsc/ssr";
import * as ReactDOMServer from "react-dom/server.edge";
import type { RscPayload } from "./server.js";
import { ErrorFallback } from "./error-handling/browser.js";

export * from "./error-handling/browser.js";

export type RenderHTML = typeof renderHTML;

export async function renderHTML(
  rscStream: ReadableStream<Uint8Array>,
  options?: {
    formState?: ReactFormState;
    nonce?: string;
    debugNojs?: boolean;
    onError?: (error: unknown, errorInfo: ErrorInfo) => void;
  }
) {
  // duplicate one RSC stream into two.
  // - one for SSR (ReactClient.createFromReadableStream below)
  // - another for browser hydration payload by injecting <script>...FLIGHT_DATA...</script>.
  const [rscStream1, rscStream2] = rscStream.tee();

  // deserialize RSC stream back to React VDOM
  let payload: Promise<RscPayload>;
  function SsrRoot() {
    // deserialization needs to be kicked off inside ReactDOMServer context
    // for ReactDomServer preinit/preloading to work
    payload ??= ReactClient.createFromReadableStream<RscPayload>(rscStream1);
    const { root } = React.use(payload);
    return root;
  }

  // render html (traditional SSR)
  const bootstrapScriptContent =
    await import.meta.viteRsc.loadBootstrapScriptContent("index");
  const htmlStream = await ReactDOMServer.renderToReadableStream(<SsrRoot />, {
    bootstrapScriptContent: options?.debugNojs
      ? undefined
      : bootstrapScriptContent,
    nonce: options?.nonce,
    onError: options?.onError,
    // no types
    ...{ formState: options?.formState },
  });

  let responseStream: ReadableStream<Uint8Array> = htmlStream;
  if (!options?.debugNojs) {
    // initial RSC stream is injected in HTML stream as <script>...FLIGHT_DATA...</script>
    responseStream = responseStream.pipeThrough(
      injectRscStreamToHtml(rscStream2, {
        nonce: options?.nonce,
      })
    );
  }

  return responseStream;
}

export async function renderErrorBoundaryResponse(opts: {
  message: string;
  stack?: string;
}) {
  let error: Error | null = null;

  if (process.env.NODE_ENV === "development") {
    if (opts.stack) {
      error = new Error(opts.message, {
        // @ts-ignore
        stack: opts.stack,
      });
    } else {
      error = new Error(opts.message);
    }
  }

  return await ReactDOMServer.renderToReadableStream(
    <ErrorFallback error={error} />,
    {}
  );
}
