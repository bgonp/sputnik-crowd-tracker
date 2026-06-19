import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror the tsconfig `@/* -> src/*` path alias so component tests can
    // import modules the same way the app does.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // happy-dom gives component tests a DOM without the weight of jsdom; the
    // pure-logic tests (queries, slug helpers, routing) run fine in it too.
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      // Report-only — no thresholds, never fails CI. Run with `pnpm test:coverage`.
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}", // test files themselves
        "src/components/ui/**", // vendored shadcn / Base UI primitives
        "src/app/layout.tsx", // static shell
        "src/app/opengraph-image.tsx", // edge image generation, not unit-testable
        "src/lib/db.ts", // Turso client singleton built from env — nothing to unit-test
        "src/lib/cached-queries.ts", // thin unstable_cache wrappers over the tested queries
        "**/*.d.ts",
      ],
    },
  },
});
