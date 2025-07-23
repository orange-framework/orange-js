import * as React from "react";
import { ActorState, Actor as CfActor, getActor } from "@cloudflare/actors";
import { isValidElement } from "react";
import { ClientComponent } from "./cl.js";

export * from "@cloudflare/actors";

export * from "./observed.js";

// TODO: remove this hack once dependency de-dupe works
function rsc() {
  // @ts-ignore
  return globalThis.rsc as typeof import("@vitejs/plugin-rsc/rsc");
}

type RSCPayload = { root: React.ReactNode };

export abstract class Actor<Env> extends CfActor<Env> {
  abstract Component(
    props: Record<string, unknown>
  ): React.ReactNode | Promise<React.ReactNode>;

  async __rscStream(
    name: string,
    props: Record<string, any>
  ): Promise<ReadableStream> {
    const Component = (this[name as keyof this] as any).bind(this);
    const rscStream = rsc().renderToReadableStream<RSCPayload>({
      root: <Component {...props} />,
    });
    return rscStream;
  }

  static Component = Component;

  static {
    Object.defineProperty(this, "__orangeIsActor", {
      value: true,
      enumerable: false,
    });
  }
}

async function InternalComponent<T extends Actor<Env>, Env>(
  props: {
    actor: ActorConstructor<T>;
    name?: string;
  } & PropsFromDurableObject<T, Env, "Component">
) {
  if ("children" in props) {
    throw new Error("Children are not currently supported");
  }

  for (const key in props) {
    if (key === "actor") {
      continue;
    }

    const value = props[key as keyof typeof props];
    if (typeof value === "function") {
      throw new Error("Functions are not currently supported");
    }

    if (isValidElement(value)) {
      throw new Error("React components are not currently supported");
    }
  }

  const stub = getActor(props.actor, props.name ?? "default");
  const { actor, ...rest } = props;

  // TODO: Remove this hack once the data-race in actors is fixed
  await new Promise((resolve) => setTimeout(resolve, 25));

  const rscStream = await stub.__rscStream("Component", rest);
  const payload = await rsc().createFromReadableStream<RSCPayload>(rscStream);

  return payload.root;
}

type PropsFromDurableObject<
  T extends Actor<Env>,
  Env,
  K extends keyof T
> = T[K] extends (arg: infer Z) => React.ReactNode | Promise<React.ReactNode>
  ? Z
  : never;

export type ActorConstructor<T extends Actor<any> = Actor<any>> = new (
  state: ActorState,
  env: any
) => T;

export { getActor } from "@cloudflare/actors";

async function Component<T extends Actor<Env>, Env>(
  props: {
    actor: ActorConstructor<T>;
    name?: string;
    observed?: boolean;
  } & PropsFromDurableObject<T, Env, "Component">
) {
  if (props.observed) {
    return (
      <ClientComponent
        actorName={props.actor.name}
        id={props.name ?? "default"}
      >
        <InternalComponent {...props} />
      </ClientComponent>
    );
  }

  return await InternalComponent(props);
}
