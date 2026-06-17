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
  },
});
