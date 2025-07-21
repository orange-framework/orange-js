import { app } from "@orange-js/orange/server";
import rootStyles from "./root.css?inline";

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{rootStyles}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}

export default app(Root);
