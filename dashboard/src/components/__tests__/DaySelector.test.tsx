import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/las-rozas",
  useSearchParams: () => new URLSearchParams(),
}));

// The popover is a portalled base-ui popup that's brittle to open in happy-dom.
// Render its trigger/content inline so we can drive the calendar grid directly;
// the grid math itself is covered by lib/__tests__/calendar.test.ts.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { DaySelector } from "../DaySelector";

beforeEach(() => {
  push.mockReset();
});

// today is a Saturday; the window reaches back ~30 days.
const base = {
  today: "2026-06-20",
  minDate: "2026-05-22",
  availableDates: ["2026-06-16", "2026-06-18", "2026-06-19", "2026-06-20"],
  triggerLabel: "Hoy",
};

describe("DaySelector", () => {
  it("shows the trigger label and the selected day's month", () => {
    render(<DaySelector {...base} selected="2026-06-20" />);
    expect(screen.getByText("Hoy")).toBeInTheDocument();
    expect(screen.getByText("junio 2026")).toBeInTheDocument();
  });

  it("navigates with ?date when a past day is picked", async () => {
    render(<DaySelector {...base} selected="2026-06-20" triggerLabel="Hoy" />);
    await userEvent.click(screen.getByLabelText("2026-06-18"));
    expect(push).toHaveBeenCalledWith("/las-rozas?date=2026-06-18", { scroll: false });
  });

  it("drops ?date when today is picked from a past selection", async () => {
    render(<DaySelector {...base} selected="2026-06-18" triggerLabel="Jue 18 jun" />);
    await userEvent.click(screen.getByLabelText("2026-06-20"));
    expect(push).toHaveBeenCalledWith("/las-rozas", { scroll: false });
  });

  it("does not navigate when a future (disabled) day is clicked", async () => {
    render(<DaySelector {...base} selected="2026-06-20" />);
    await userEvent.click(screen.getByLabelText("2026-06-21")); // after today → disabled
    expect(push).not.toHaveBeenCalled();
  });

  it("disables past days that have no data, keeping the ones that do", () => {
    render(<DaySelector {...base} selected="2026-06-20" />);
    expect(screen.getByLabelText("2026-06-18")).toBeEnabled(); // in availableDates
    expect(screen.getByLabelText("2026-06-17")).toBeDisabled(); // not in availableDates
  });
});
