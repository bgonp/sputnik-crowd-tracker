import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { push, state } = vi.hoisted(() => ({
  push: vi.fn(),
  state: { pathname: "/alcobendas", searchParams: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => state.pathname,
  useSearchParams: () => state.searchParams,
}));

import { UnitToggle } from "../UnitToggle";

beforeEach(() => {
  push.mockReset();
  state.pathname = "/alcobendas";
  state.searchParams = new URLSearchParams();
});

describe("UnitToggle", () => {
  it("shows % in percentage mode and switches to absolute on click", async () => {
    const user = userEvent.setup();
    render(<UnitToggle unit="percentage" />);
    expect(screen.getByText("%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cambiar unidades" }));
    expect(push).toHaveBeenCalledWith("/alcobendas?unit=absolute", { scroll: false });
  });

  it("shows # in absolute mode and clears the unit on click (no trailing ?)", async () => {
    state.searchParams = new URLSearchParams("unit=absolute");
    const user = userEvent.setup();
    render(<UnitToggle unit="absolute" />);
    expect(screen.getByText("#")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cambiar unidades" }));
    expect(push).toHaveBeenCalledWith("/alcobendas", { scroll: false });
  });

  it("preserves other query params when toggling", async () => {
    state.searchParams = new URLSearchParams("x=1");
    const user = userEvent.setup();
    render(<UnitToggle unit="percentage" />);
    await user.click(screen.getByRole("button", { name: "Cambiar unidades" }));
    expect(push).toHaveBeenCalledWith("/alcobendas?x=1&unit=absolute", { scroll: false });
  });
});
