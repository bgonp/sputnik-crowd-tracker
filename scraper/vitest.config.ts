import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      // Report-only — no thresholds, never fails CI. Run with `pnpm test:coverage`.
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/seed-dev.ts", // dev-only mock data generator
        "**/*.d.ts",
      ],
    },
  },
});
