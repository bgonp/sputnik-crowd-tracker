import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { setTheme, state } = vi.hoisted(() => ({
  setTheme: vi.fn(),
  state: { theme: "system" as string },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: state.theme, setTheme }),
}));

import { ThemeToggle } from "../ThemeToggle";

beforeEach(() => {
  setTheme.mockReset();
  state.theme = "system";
});

describe("ThemeToggle", () => {
  it("cycles system → light", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("cycles light → dark", async () => {
    state.theme = "light";
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("cycles dark → system", async () => {
    state.theme = "dark";
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Switch to system theme" }));
    expect(setTheme).toHaveBeenCalledWith("system");
  });
});
