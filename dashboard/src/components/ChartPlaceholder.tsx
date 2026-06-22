import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  label: string;
  // The real chart, rendered with no data, to stand behind the prompt — so the
  // empty state looks like the chart it replaces rather than a generic shape.
  children: ReactNode;
  className?: string;
}

// Empty state for the chart cards on the all-venues overview (`/`): the real
// chart frame with no data, dimmed and inert, under a centered prompt telling
// the user to pick a venue. Reusing the actual charts (fed empty data) keeps the
// placeholder and the loaded chart visually consistent — same axes, labels, and
// legend — instead of a silhouette that drifts from what it stands in for.
export function ChartPlaceholder({ icon, label, children, className = "h-64" }: Props) {
  return (
    <div className={`relative w-full ${className}`}>
      <div className="pointer-events-none select-none opacity-40" aria-hidden>
        {children}
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
