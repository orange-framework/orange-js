import { DurableObject, RpcStub } from "cloudflare:workers";
import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { getAllMethods } from "./util.js";
import { CloudflareEnv } from "./index.js";

export type IdentifierFunctionArgs = LoaderFunctionArgs<{
  cloudflare: { env: CloudflareEnv };
}>;

export type DurableLoaderFunctionArgs = {
  request: Request;
  params: Params;
};

export type DurableActionFunctionArgs = {
  request: Request;
  params: Params;
};

export type WebsocketConnectArgs = {
  client: WebSocket;
  server: WebSocket;
  request: Request;
  params: Params;
};

export class RouteDurableObject<Env> extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  override async fetch(request: Request): Promise<Response> {
    if (
      this.webSocketConnect &&
      request.headers.get("Upgrade") === "websocket"
    ) {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const resp = await this.webSocketConnect({
        client,
        server,
        request,
        params: JSON.parse(request.headers.get("x-orange-params") ?? "{}"),
      });
      return resp;
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  loader?(args: DurableLoaderFunctionArgs): Promise<unknown>;
  action?(args: DurableActionFunctionArgs): Promise<unknown>;
  webSocketConnect?(args: WebsocketConnectArgs): Promise<Response>;
}

type Syncify<T> = T extends Promise<infer U> ? U : T;

type SerializeLoaderFrom<
  T extends RouteDurableObject<unknown>,
  Key extends keyof T = "loader"
> = Syncify<
  ReturnType<T[Key] extends (...args: any[]) => any ? T[Key] : never>
>;

export function useDurableObject<
  Obj extends RouteDurableObject<unknown>
>(): SerializeLoaderFrom<Obj> {
  return useLoaderData() as SerializeLoaderFrom<Obj>;
}

function innerDataIn<
  Obj extends RouteDurableObject<unknown>,
  Key extends keyof Obj,
  Env
>(
  durableObject: new (ctx: DurableObjectState, env: Env) => Obj,
  method: Key,
  nameGetter:
    | string
    | ((args: IdentifierFunctionArgs) => Promise<string> | string)
): (args: IdentifierFunctionArgs) => Promise<SerializeLoaderFrom<Obj, Key>> {
  return async (args): Promise<SerializeLoaderFrom<Obj, Key>> => {
    // @ts-ignore
    const namespace = args.context.cloudflare.env[
      durableObject.name
    ] as DurableObjectNamespace;
    const name =
      typeof nameGetter === "function"
        ? await nameGetter({
            ...args,
            // @ts-ignore
            request: args.request?.clone(),
          })
        : nameGetter;

    if (name === undefined) {
      throw new Error(
        "DurableObject did not have a static name function specified"
      );
    }

    const doID = namespace.idFromName(name);
    const stub = namespace.get(doID);

    const ret = await (stub as any)[method]({
      ...args,
      context: undefined,
    });

    if (ret instanceof Response) {
      // @ts-ignore
      return ret;
    }

    if (ret instanceof RpcStub) {
      throw new Error(
        "`RpcStub`s cannot be used as loader or action data, wrap your return data in the `data` function to avoid this error."
      );
    }

    // @ts-ignore
    return ret as SerializeLoaderFrom<Obj, Key>;
  };
}

export function loaderIn<
  Obj extends RouteDurableObject<unknown>,
  Key extends keyof Obj,
  Env
>(
  durableObject: new (ctx: DurableObjectState, env: Env) => Obj,
  method: Key,
  nameGetter:
    | string
    | ((args: IdentifierFunctionArgs) => Promise<string> | string)
): (args: IdentifierFunctionArgs) => Promise<SerializeLoaderFrom<Obj, Key>> {
  return innerDataIn(durableObject, method, nameGetter);
}

export function actionIn<
  Obj extends RouteDurableObject<unknown>,
  Key extends keyof Obj,
  Env
>(
  durableObject: new (ctx: DurableObjectState, env: Env) => Obj,
  method: Key,
  nameGetter:
    | string
    | ((args: IdentifierFunctionArgs) => Promise<string> | string)
): (args: IdentifierFunctionArgs) => Promise<SerializeLoaderFrom<Obj, Key>> {
  return innerDataIn(durableObject, method, nameGetter);
}
