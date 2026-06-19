import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      // Report-only — no thresholds, never fails CI. Run with `pnpm test:coverage`.
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts", // test files themselves
        "src/seed-dev.ts", // dev-only mock data generator
        "src/index.ts", // network ingestion entry — covered in production by the freshness monitor
        "src/migrate.ts", // one-off DDL / ops script
        "**/*.d.ts",
      ],
    },
  },
});
