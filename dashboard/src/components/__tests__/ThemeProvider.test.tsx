import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// next-themes touches window.matchMedia, which happy-dom doesn't implement;
// stub the provider to a pass-through so this stays a wrapper-shape smoke test.
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ThemeProvider } from "../ThemeProvider";

describe("ThemeProvider", () => {
  it("renders its children", () => {
    render(
      <ThemeProvider>
        <span>themed content</span>
      </ThemeProvider>
    );
    expect(screen.getByText("themed content")).toBeInTheDocument();
  });
});
