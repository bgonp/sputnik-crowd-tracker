import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AutoRefresh } from "../AutoRefresh";

let focused = true;
function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => value,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset();
  focused = true;
  document.hasFocus = () => focused;
  setVisibility("visible");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AutoRefresh", () => {
  it("refreshes on each interval while the tab is active", () => {
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

  it("refreshes immediately and resumes when the tab becomes active again", () => {
    setVisibility("hidden");
    focused = false;
    render(<AutoRefresh intervalMs={1000} />);
    vi.advanceTimersByTime(2000);
    expect(refresh).not.toHaveBeenCalled(); // inactive at mount → no polling

    setVisibility("visible");
    focused = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1); // immediate refresh on becoming active

    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(2); // and resumes polling
  });
});
