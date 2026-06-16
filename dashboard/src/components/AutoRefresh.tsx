"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;

    // Only poll while the tab is both visible and focused, so backgrounded or
    // unfocused tabs stop hitting the database (keeps Turso reads down).
    const isActive = () =>
      document.visibilityState === "visible" && document.hasFocus();

    const stop = () => {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    };

    const start = () => {
      if (id === undefined) {
        id = setInterval(() => router.refresh(), intervalMs);
      }
    };

    const sync = () => {
      if (isActive()) {
        router.refresh(); // pull fresh data the moment the tab becomes active again
        start();
      } else {
        stop();
      }
    };

    if (isActive()) start();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
    };
  }, [router, intervalMs]);

  return null;
}
