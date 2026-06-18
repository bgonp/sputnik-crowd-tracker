import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DailyVisitorCount, LiveReading } from "@/lib/queries";

const { push, state } = vi.hoisted(() => ({
  push: vi.fn(),
  state: { searchParams: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => state.searchParams,
}));

import { LiveCards } from "../LiveCards";

const readings: LiveReading[] = [
  { venueId: 1, venueName: "Alcobendas Principal", occupancy: 100, capacity: 200, percentage: 50, timestamp: "2026-06-18T10:00:00Z" },
  { venueId: 2, venueName: "Las Rozas Principal", occupancy: 30, capacity: 300, percentage: 10, timestamp: "2026-06-18T10:00:00Z" },
];
const todayCounts: DailyVisitorCount[] = [{ venueId: 1, total: 420 }];

const cardOf = (name: string) =>
  screen.getByText(name).closest('[data-slot="card"]') as HTMLElement;

beforeEach(() => {
  push.mockReset();
  state.searchParams = new URLSearchParams();
});

describe("LiveCards", () => {
  it("renders a card per venue with its stats", () => {
    render(<LiveCards readings={readings} todayCounts={todayCounts} selectedId={1} />);
    expect(screen.getByText("Alcobendas")).toBeInTheDocument(); // " Principal" stripped
    expect(screen.getByText("Las Rozas")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("100 / 200 personas")).toBeInTheDocument();
    expect(screen.getByText("420 visitas hoy")).toBeInTheDocument();
  });

  it("highlights the selected venue and not the others", () => {
    render(<LiveCards readings={readings} todayCounts={todayCounts} selectedId={1} />);
    // The selection ring is the contiguous `ring-2 ring-primary`; the always-on
    // focus ring (`focus-visible:ring-2 …`) must not be mistaken for it.
    expect(cardOf("Alcobendas").className).toContain("ring-2 ring-primary");
    expect(cardOf("Las Rozas").className).not.toContain("ring-2 ring-primary");
  });

  it("navigates to the slug path when a venue is clicked", async () => {
    const user = userEvent.setup();
    render(<LiveCards readings={readings} todayCounts={todayCounts} selectedId={1} />);
    await user.click(cardOf("Las Rozas"));
    expect(push).toHaveBeenCalledWith("/las-rozas", { scroll: false });
  });

  it("preserves an absolute unit in the navigation", async () => {
    state.searchParams = new URLSearchParams("unit=absolute");
    const user = userEvent.setup();
    render(<LiveCards readings={readings} todayCounts={todayCounts} selectedId={1} />);
    await user.click(cardOf("Las Rozas"));
    expect(push).toHaveBeenCalledWith("/las-rozas?unit=absolute", { scroll: false });
  });

  it("does nothing when the already-selected venue is clicked", async () => {
    const user = userEvent.setup();
    render(<LiveCards readings={readings} todayCounts={todayCounts} selectedId={1} />);
    await user.click(cardOf("Alcobendas"));
    expect(push).not.toHaveBeenCalled();
  });

  it("exposes each venue as a focusable button", () => {
    render(<LiveCards readings={readings} todayCounts={todayCounts} selectedId={1} />);
    // Assert the behaviour (keyboard-focusable), not the tabindex attribute, so
    // this stays green if the card ever becomes a native <button>.
    const card = screen.getByRole("button", { name: "Ver gráficas de Las Rozas" });
    card.focus();
    expect(card).toHaveFocus();
  });

  it("navigates when a card is activated with Enter", async () => {
    const user = userEvent.setup();
    render(<LiveCards readings={readings} todayCounts={todayCounts} selectedId={1} />);
    screen.getByRole("button", { name: "Ver gráficas de Las Rozas" }).focus();
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/las-rozas", { scroll: false });
  });

  it("navigates when a card is activated with Space", async () => {
    const user = userEvent.setup();
    render(<LiveCards readings={readings} todayCounts={todayCounts} selectedId={1} />);
    screen.getByRole("button", { name: "Ver gráficas de Las Rozas" }).focus();
    await user.keyboard(" ");
    expect(push).toHaveBeenCalledWith("/las-rozas", { scroll: false });
  });
});
