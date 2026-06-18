import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount any rendered components and reset the DOM between tests (RTL doesn't
// auto-clean without globals enabled).
afterEach(() => {
  cleanup();
});
