import { Plugin } from "vite";
import { Context } from "../index.js";
import { unreachable } from "../util.js";
import { resolve } from "node:path";
import { VirtualModule } from "../virtual-module.js";

export function agentsMiddlewareInjector(ctx: Context): Plugin {
  return {
    name: "orange:agents-middleware-injector",
    enforce: "pre",
    applyToEnvironment(environment) {
      return environment.name !== "client";
    },
    transform(code, id) {
      const routes = ctx.componentRoutes ?? unreachable();
      const routeFiles = Object.values(routes).map((route) =>
        resolve(route.file)
      );
      if (!routeFiles.includes(id)) {
        return;
      }

      const className = agentInCode(code);
      if (!className) {
        return;
      }

      const inject = `
      globalThis.middlewareStages ??= [];
      globalThis.middlewareStages.push(async (request, env) => {
        const agents = await import("agents");
        try {
          const maybeResp = await agents.routeAgentRequest(request, env);
          return maybeResp;
        } catch (e) {
          console.error(e);
          return new Response("Internal Server Error", { status: 500 });
        }
      })
      `;
      return `${code}\n${inject}`;
    },
  };
}

const agentsVmod = new VirtualModule("agents-stub");

export function agentsClientStub(_: Context): Plugin {
  return {
    name: "orange:agents-resolver",
    enforce: "pre",
    applyToEnvironment(environment) {
      return environment.name === "client";
    },
    resolveId(id) {
      if (id === "agents") {
        return agentsVmod.id;
      }
    },
    async load(id) {
      if (agentsVmod.is(id)) {
        return emptyExports([
          "Agent",
          "StreamingResponse",
          "getAgentByName",
          "routeAgentEmail",
          "routeAgentRequest",
          "unstable_callable",
          "unstable_context",
        ]);
      }
    },
  };
}

function agentInCode(contents: string): string | undefined {
  const matches =
    /export\s+class\s+(\w+)\s+extends\s+(?:Agent|AIChatAgent)/.exec(contents);
  if (!matches || !matches[1]) {
    return undefined;
  }

  return matches[1];
}

const emptyExports = (exports: string[]) => {
  return exports.map((e) => `export const ${e} = undefined;`).join("\n");
};
