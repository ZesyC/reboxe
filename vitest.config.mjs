import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ["**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "apps/web/e2e/**", ".venv-ai/**", ".cache-ai/**", ".local-test/**"]
  }
});
