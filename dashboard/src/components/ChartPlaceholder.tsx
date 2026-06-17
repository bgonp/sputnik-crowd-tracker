import type { ReactNode } from "react";

// Fixed bar heights (no randomness, so SSR and client render identically) for a
// faint chart silhouette behind the call-to-action.
const GHOST_BARS = [40, 62, 48, 78, 58, 88, 70, 52, 74, 44, 82, 60];

interface Props {
  icon: ReactNode;
  label: string;
  className?: string;
}

// Empty state for the chart cards on the all-venues overview (`/`): a dimmed
// chart silhouette with a centered prompt telling the user to pick a venue.
// Purely static — fetches nothing.
export function ChartPlaceholder({ icon, label, className = "h-52" }: Props) {
  return (
    <div className={`relative w-full overflow-hidden rounded-md bg-muted/30 ${className}`}>
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
