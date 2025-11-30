import type { Plugin } from "vite";

export function configPlugin(): Plugin {
  return {
    name: "orange:config",
    config: (config) => {
      return {
        ...config,
        environments: {
          rsc: {
            build: {
              rollupOptions: {
                // ensure `default` export only in cloudflare entry output
                preserveEntrySignatures: "exports-only",
              },
            },
            optimizeDeps: {
              include: ["react", "react-dom", "@orange-js/actors"],
              exclude: ["virtual:orange/routes", "@orange-js/actors/client"],
            },
          },
          ssr: {
            keepProcessEnv: false,
            build: {
              // build `ssr` inside `rsc` directory so that
              // wrangler can deploy self-contained `dist/rsc`
              outDir: "./dist/rsc/ssr",
            },
            resolve: {
              noExternal: true,
              dedupe: ["react", "react-dom"],
            },
            optimizeDeps: {
              include: ["react", "react-dom"],
            },
          },
          client: {
            build: {
              rollupOptions: {
                external: ["virtual:orange/routes"],
              },
            },
            resolve: {
              dedupe: ["react", "react-dom"],
            },
            optimizeDeps: {
              exclude: [
                "cloudflare:workers",
                "virtual:orange/routes",
                "cloudflare:workerflows",
              ],
            },
          },
        },
      };
    },
  };
}
