"use client";

import { DAY_LABELS, HEATMAP_FIRST_HOUR, HOUR_LABELS } from "@/lib/labels";
import { isHeatmapCellOpen } from "@/lib/open-status";
import type { HeatmapCell, VenueHours } from "@/lib/queries";

function cellStyle(pct: number): React.CSSProperties {
  if (pct === 0) return {};
  const hue = 120 - Math.pow(pct / 100, 0.5) * 120;
  return { backgroundColor: `hsl(${hue.toFixed(1)} 70% 60%)` };
}

export function HeatmapChart({
  data,
  venueId,
  hours,
}: {
  data: HeatmapCell[];
  venueId: number;
  hours: VenueHours[];
}) {
  const lookup = new Map(data.map((d) => [`${d.day}-${d.hour}`, d.avgPercentage]));

  return (
    // Fixed-height column so the card matches the line chart's: the grid starts
    // right under the title and its rows stretch to fill the available space, so
    // the table spans the same height as the line chart's plot, with the legend
    // pinned to the bottom (the line chart's legend-at-bottom layout).
    <div className="flex h-64 flex-col">
      <div className="mb-3 min-h-0 flex-1">
        <div className="flex h-full flex-col">
          <div className="flex shrink-0">
            <div className="w-8 shrink-0" />
            {HOUR_LABELS.slice(HEATMAP_FIRST_HOUR).map((label, i) => (
              <div key={i} className="flex-1 m-px text-center text-[10px] text-muted-foreground">
                {label.slice(0, 2)}
              </div>
            ))}
          </div>
          {DAY_LABELS.map((day, d) => (
            <div key={d} className="flex flex-1 gap-0">
              <div className="w-8 shrink-0 flex items-center justify-end pr-1 text-[11px] text-muted-foreground">
                {day}
              </div>
              {HOUR_LABELS.slice(HEATMAP_FIRST_HOUR).map((_, i) => {
                const h = i + HEATMAP_FIRST_HOUR;
                // Outside the venue's open window: render a diagonally-hatched cell
                // flagged as closed, so the grid clearly reads as "the gym was closed
                // then" — distinct from both colored data and the flat muted "Sin
                // datos" of an open hour with no readings.
                if (!isHeatmapCellOpen(hours, venueId, d, h)) {
                  return (
                    <div
                      key={h}
                      title={`${day} ${HOUR_LABELS[h]}: cerrado`}
                      className="flex-1 m-px rounded-sm bg-muted"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(45deg, color-mix(in oklch, var(--color-muted-foreground) 35%, transparent) 0, color-mix(in oklch, var(--color-muted-foreground) 35%, transparent) 1px, transparent 1px, transparent 5px)",
                      }}
                    />
                  );
                }
                const pct = lookup.get(`${d}-${h}`) ?? 0;
                return (
                  <div
                    key={h}
                    title={pct > 0 ? `${day} ${HOUR_LABELS[h]}: ${pct}%` : "Sin datos"}
                    className={`flex-1 m-px rounded-sm flex items-center justify-center ${pct === 0 ? "bg-muted" : ""}`}
                    style={cellStyle(pct)}
                  >
                    {pct > 0 && (
                      <span className="text-[9px] leading-none font-medium text-black/70 select-none">
                        {pct}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend pinned to the bottom of the column and centered, like the line chart's. */}
      <div className="flex items-center justify-center gap-2 pt-3 text-xs text-muted-foreground">
        <span>0% ocupación</span>
        <div
          className="h-3 w-32 rounded-sm"
          style={{ background: "linear-gradient(to right, hsl(120 70% 60%), hsl(72 70% 60%), hsl(40 70% 60%), hsl(20 70% 60%), hsl(0 70% 60%))" }}
        />
        <span>100% ocupación</span>
      </div>
    </div>
  );
}
