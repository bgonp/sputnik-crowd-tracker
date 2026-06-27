"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;

    // Pause while the tab is hidden; resume the moment it becomes visible again.
    // We intentionally do NOT check hasFocus() here — that check caused a race:
    // visibilitychange fires before the browser updates hasFocus(), so the
    // transition was missed and polling never restarted after a tab switch.
    const isVisible = () => document.visibilityState === "visible";

    let visible = isVisible();

    const doRefresh = () => startTransition(() => router.refresh());

    const stop = () => {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    };

    const start = () => {
      if (id === undefined) {
        id = setInterval(doRefresh, intervalMs);
      }
    };

    const sync = () => {
      const nowVisible = isVisible();
      if (nowVisible === visible) return;
      visible = nowVisible;

      if (nowVisible) {
        doRefresh(); // pull fresh data the moment the tab becomes visible again
        start();
      } else {
        stop();
      }
    };

    if (visible) start();
    document.addEventListener("visibilitychange", sync);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [router, intervalMs, startTransition]);

  return isPending ? (
    <Loader2 aria-hidden className="size-3.5 animate-spin text-muted-foreground" />
  ) : (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      aria-label="Actualizar"
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      <RefreshCw aria-hidden className="size-3.5" />
    </button>
  );
}
