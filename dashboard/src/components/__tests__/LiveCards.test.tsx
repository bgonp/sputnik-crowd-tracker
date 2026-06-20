import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DailyVisitorCount, LiveReading, VenueHours } from "@/lib/queries";
import type { MadridMoment } from "@/lib/open-status";

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

// Wednesday noon — inside every venue's open window.
const OPEN_NOW: MadridMoment = { dow: 3, minuteOfDay: 12 * 60 };

// Empty hours → every venue reads as open (fail-safe), so the live stats show.
const renderCards = (overrides: {
  venueHours?: VenueHours[];
  nowMoment?: MadridMoment;
  selectedId?: number;
} = {}) =>
  render(
    <LiveCards
      readings={readings}
      todayCounts={todayCounts}
      venueHours={overrides.venueHours ?? []}
      nowMoment={overrides.nowMoment ?? OPEN_NOW}
      selectedId={overrides.selectedId ?? 1}
    />
  );

const cardOf = (name: string) =>
  screen.getByText(name).closest('[data-slot="card"]') as HTMLElement;

beforeEach(() => {
  push.mockReset();
  state.searchParams = new URLSearchParams();
});

describe("LiveCards", () => {
  it("renders a card per venue with its stats", () => {
    renderCards();
    expect(screen.getByText("Alcobendas")).toBeInTheDocument(); // " Principal" stripped
    expect(screen.getByText("Las Rozas")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("100 / 200 personas")).toBeInTheDocument();
    expect(screen.getByText("420 visitas hoy")).toBeInTheDocument();
  });

  it("highlights the selected venue and not the others", () => {
    renderCards();
    // The selection ring is the contiguous `ring-2 ring-primary`; the always-on
    // focus ring (`focus-visible:ring-2 …`) must not be mistaken for it.
    expect(cardOf("Alcobendas").className).toContain("ring-2 ring-primary");
    expect(cardOf("Las Rozas").className).not.toContain("ring-2 ring-primary");
  });

  it("navigates to the slug path when a venue is clicked", async () => {
    const user = userEvent.setup();
    renderCards();
    await user.click(cardOf("Las Rozas"));
    expect(push).toHaveBeenCalledWith("/las-rozas", { scroll: false });
  });

  it("preserves an absolute unit in the navigation", async () => {
    state.searchParams = new URLSearchParams("unit=absolute");
    const user = userEvent.setup();
    renderCards();
    await user.click(cardOf("Las Rozas"));
    expect(push).toHaveBeenCalledWith("/las-rozas?unit=absolute", { scroll: false });
  });

  it("does nothing when the already-selected venue is clicked", async () => {
    const user = userEvent.setup();
    renderCards();
    await user.click(cardOf("Alcobendas"));
    expect(push).not.toHaveBeenCalled();
  });

  it("exposes each venue as a focusable button", () => {
    renderCards();
    // Assert the behaviour (keyboard-focusable), not the tabindex attribute, so
    // this stays green if the card ever becomes a native <button>.
    const card = screen.getByRole("button", { name: "Ver gráficas de Las Rozas" });
    card.focus();
    expect(card).toHaveFocus();
  });

  it("navigates when a card is activated with Enter", async () => {
    const user = userEvent.setup();
    renderCards();
    screen.getByRole("button", { name: "Ver gráficas de Las Rozas" }).focus();
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/las-rozas", { scroll: false });
  });

  it("navigates when a card is activated with Space", async () => {
    const user = userEvent.setup();
    renderCards();
    screen.getByRole("button", { name: "Ver gráficas de Las Rozas" }).focus();
    await user.keyboard(" ");
    expect(push).toHaveBeenCalledWith("/las-rozas", { scroll: false });
  });

  it("shows 'Cerrado' and the next opening for a venue closed right now", () => {
    // 02:00 Wednesday: Las Rozas (07:00–23:00 weekday) is closed; Alcobendas has
    // no hours configured, so it stays open and shows its live stats.
    renderCards({
      venueHours: [{ venueId: 2, dow: 3, openMin: 7 * 60, closeMin: 23 * 60 }],
      nowMoment: { dow: 3, minuteOfDay: 2 * 60 },
    });

    const lasRozas = cardOf("Las Rozas");
    expect(within(lasRozas).getByText("Cerrado")).toBeInTheDocument();
    expect(within(lasRozas).getByText("Abre a las 07:00")).toBeInTheDocument();
    expect(within(lasRozas).queryByText("10%")).not.toBeInTheDocument();

    // Alcobendas (no schedule) keeps showing live occupancy.
    expect(within(cardOf("Alcobendas")).getByText("50%")).toBeInTheDocument();
  });

  it("shows live occupancy (never 'Cerrado') when no hours are configured", () => {
    renderCards({ venueHours: [] });
    expect(screen.queryByText("Cerrado")).not.toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
