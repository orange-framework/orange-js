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
              exclude: ["virtual:orange/routes"],
            },
          },
          ssr: {
            keepProcessEnv: false,
            build: {
              // build `ssr` inside `rsc` directory so that
              // wrangler can deploy self-contained `dist/rsc`
              outDir: "./dist/rsc/ssr",
            },
            optimizeDeps: {
              exclude: [
                "virtual:orange/routes",
                "cloudflare:workers",
                "cloudflare:workerflows",
              ],
            },
          },
          client: {
            build: {
              rollupOptions: {
                external: ["virtual:orange/routes"],
              },
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
