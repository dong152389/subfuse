import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/core/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@subfuse/core": path.resolve(__dirname, "packages/core/src"),
      "@subfuse/server-core": path.resolve(__dirname, "packages/server-core/src"),
    },
  },
});
