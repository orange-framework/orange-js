import orange from "@orange-js/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // @ts-expect-error - vite type mismatch
  plugins: [orange(), tsconfigPaths(), tailwindcss()],
  build: {
    minify: true,
  },
});
