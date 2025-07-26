import * as React from "react";
import { Actor } from "./index.js";
import { type JSX } from "react";

// TODO: remove this hack once dependency de-dupe works
function rsc() {
  // @ts-ignore
  return globalThis.rsc as typeof import("@vitejs/plugin-rsc/rsc");
}

type ClassMethodDecorator<Args extends any[], Return> = (
  value: (...args: Args) => Return,
  context: ClassMethodDecoratorContext
) => any;

export const observedSymbol = Symbol("orange:observed");

export function Observed(
  ...names: string[]
): ClassMethodDecorator<any[], Promise<JSX.Element>> {
  return function (this: Actor<any>, value, context) {
    context.addInitializer(function () {
      const self = this as Actor<any>;

      // @ts-ignore
      self[observedSymbol] = true;

      self["onPersist"] = async () => {
        const ret = await value.apply(this);
        const stream = rsc().renderToReadableStream({
          root: ret,
        });

        const rscPayload = await new Response(stream).bytes();

        // @ts-ignore
        const websockets = self.ctx.getWebSockets();

        // @ts-ignore
        for (const ws of websockets) {
          ws.send(rscPayload);
        }
      };

      self["fetch"] = async (request: Request) => {
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);

        // @ts-ignore
        self.ctx.acceptWebSocket(server);

        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      };
    });

    return value;
  };
}
