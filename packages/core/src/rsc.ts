import { ErrorInfo } from "react";
import { renderHtml } from "./server.js";

export * from "@vitejs/plugin-rsc/rsc";

export async function renderServerComponentStreamToHtmlReadableStream(
  stream: ReadableStream<Uint8Array>,
  options?: {
    onError?: (error: unknown, errorInfo: ErrorInfo) => void;
  }
) {
  return await renderHtml(stream, options);
}
