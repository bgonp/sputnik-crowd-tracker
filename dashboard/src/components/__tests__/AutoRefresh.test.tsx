import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AutoRefresh } from "../AutoRefresh";

function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => value,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset();
  setVisibility("visible");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AutoRefresh", () => {
  it("refreshes on each interval while the tab is visible", () => {
    render(<AutoRefresh intervalMs={1000} />);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("stops polling when the tab becomes hidden", () => {
    render(<AutoRefresh intervalMs={1000} />);
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    vi.advanceTimersByTime(3000);
    expect(refresh).toHaveBeenCalledTimes(1); // no further refreshes while hidden
  });

  it("refreshes immediately and resumes when the tab becomes visible again", () => {
    setVisibility("hidden");
    render(<AutoRefresh intervalMs={1000} />);
    vi.advanceTimersByTime(2000);
    expect(refresh).not.toHaveBeenCalled(); // hidden at mount → no polling

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1); // immediate refresh on becoming visible

    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(2); // and resumes polling
  });

  it("does not poll when mounted while hidden", () => {
    setVisibility("hidden");
    render(<AutoRefresh intervalMs={1000} />);
    vi.advanceTimersByTime(5000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
