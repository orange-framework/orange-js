import * as React from "react";
import { Actor } from "@cloudflare/actors";
import { RscPayload } from "./server.js";
import * as rsc from "@vitejs/plugin-rsc/rsc";
import { isValidElement } from "react";

type PropsFromDurableObject<
  T extends ReactActor<Env>,
  Env,
  K extends keyof T,
> = T[K] extends (arg: infer Z) => React.ReactNode | Promise<React.ReactNode>
  ? Z
  : never;

export abstract class ReactActor<Env> extends Actor<Env> {
  async rscStream(
    name: string,
    props: Record<string, any>,
  ): Promise<ReadableStream> {
    const Component = (this[name as keyof this] as any).bind(this);
    const rscStream = rsc.renderToReadableStream<RscPayload>({
      // in this example, we always render the same `<Root />`
      root: <Component {...props} />,
    });
    return rscStream;
  }

  static Component = Component;

  abstract Component(
    props: Record<string, unknown>,
  ): React.ReactNode | Promise<React.ReactNode>;
}

async function Component<T extends ReactActor<Env>, Env>(
  props: {
    durableObject: DurableObjectNamespace<T>;
    name: string;
  } & PropsFromDurableObject<T, Env, "Component">,
) {
  if ("children" in props) {
    throw new Error("Children are not currently supported");
  }

  for (const key in props) {
    const value = props[key as keyof typeof props];
    if (typeof value === "function") {
      throw new Error("Functions are not currently supported");
    }

    if (isValidElement(value)) {
      throw new Error("React components are not currently supported");
    }
  }

  const stub = props.durableObject.get(
    props.durableObject.idFromName(props.name),
  );

  const { durableObject, ...rest } = props;

  const rscStream = await stub.rscStream("Component", rest);
  const payload = await rsc.createFromReadableStream<RscPayload>(rscStream);

  return payload.root;
}
