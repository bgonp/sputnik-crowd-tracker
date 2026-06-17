import type { ReactNode } from "react";

// Fixed values (no randomness, so SSR and client render identically) for the
// faint chart silhouette behind the call-to-action.
const GHOST_BARS = [40, 62, 48, 78, 58, 88, 70, 52, 74, 44, 82, 60];
const GRID_ROWS = 7; // days of the week, like the real heatmap
const GRID_COLS = 12; // hour buckets

// Deterministic per-cell intensity so the grid reads as a heatmap rather than a
// flat table (values in ~0.3–0.85, no Math.random to keep hydration stable).
const cellIntensity = (i: number) => 0.3 + (((i * 7 + (i % 5) * 13) % 11) / 11) * 0.55;

interface Props {
  icon: ReactNode;
  label: string;
  variant?: "bars" | "grid";
  className?: string;
}

// Empty state for the chart cards on the all-venues overview (`/`): a dimmed
// chart silhouette with a centered prompt telling the user to pick a venue.
// `variant` matches the real chart it stands in for — "bars" for the hourly
// average, "grid" for the heatmap. Purely static — fetches nothing.
export function ChartPlaceholder({ icon, label, variant = "bars", className = "h-52" }: Props) {
  return (
    <div className={`relative w-full overflow-hidden rounded-md bg-muted/30 ${className}`}>
      {variant === "bars" ? (
        <div
          className="absolute inset-x-4 bottom-4 top-6 flex items-end gap-1.5 opacity-30"
          aria-hidden
        >
          {GHOST_BARS.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-muted-foreground/40"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      ) : (
        <div
          className="absolute inset-x-4 bottom-4 top-6 grid gap-1 opacity-40"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          }}
          aria-hidden
        >
          {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => (
            <div
              key={i}
              className="rounded-[2px] bg-muted-foreground/50"
              style={{ opacity: cellIntensity(i) }}
            />
          ))}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-background/80 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
          <span className="text-muted-foreground" aria-hidden>
            {icon}
          </span>
          <p className="max-w-[24ch] text-sm font-medium text-foreground/80">{label}</p>
        </div>
      </div>
    </div>
  );
}
