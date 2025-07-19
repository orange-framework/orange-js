// Adapted from:
// https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-rsc/examples/starter-cf-single/src/framework/entry.ssr.tsx

import React, { ErrorInfo } from "react";
import { injectRscStreamToHtml } from "@vitejs/plugin-rsc/rsc-html-stream/ssr";
import type { ReactFormState } from "react-dom/client";
import * as ReactClient from "@vitejs/plugin-rsc/ssr";
import * as ReactDOMServer from "react-dom/server.edge";
import type { RscPayload } from "./server.js";

export type RenderHTML = typeof renderHTML;

export class SSRError extends Error {
  errorInfo: ErrorInfo;

  constructor(message: string, errorInfo: ErrorInfo, cause?: unknown) {
    super(message);
    this.name = "SSRError";
    this.errorInfo = errorInfo;
    this.cause = cause;
  }
}

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
