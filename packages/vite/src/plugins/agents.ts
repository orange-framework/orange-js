import { Plugin } from "vite";
import { Context } from "../index.js";
import { unreachable } from "../util.js";
import { resolve } from "node:path";

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
        const maybeResp = await agents.routeAgentRequest(request, env);
        return maybeResp;
      })
      `
      return `${code}\n${inject}`;
    },
  };
}

function agentInCode(contents: string): string | undefined {
  const matches = /export\s+class\s+(\w+)\s+extends\s+(?:Agent|AIChatAgent)/.exec(contents);
  if (!matches || !matches[1]) {
    return undefined;
  }

  return matches[1];
}
