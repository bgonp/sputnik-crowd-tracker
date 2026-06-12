"use client";

import { DAY_LABELS, HOUR_LABELS } from "@/lib/labels";
import type { HeatmapCell } from "@/lib/queries";

function cellStyle(pct: number): React.CSSProperties {
  if (pct === 0) return {};
  const hue = 120 - (pct / 100) * 120;
  return { backgroundColor: `hsl(${hue} 70% 60%)` };
}

export function HeatmapChart({ data }: { data: HeatmapCell[] }) {
  const lookup = new Map(data.map((d) => [`${d.day}-${d.hour}`, d.avgPercentage]));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <div className="flex">
          <div className="w-8 m-px" />
          {HOUR_LABELS.map((label, h) => (
            <div key={h} className="w-8 m-px text-center text-[10px] text-muted-foreground">
              {label.slice(0, 2)}
            </div>
          ))}
        </div>
        {DAY_LABELS.map((day, d) => (
          <div key={d} className="flex items-center gap-0">
            <div className="w-8 text-[11px] text-muted-foreground text-right pr-1">{day}</div>
            {HOUR_LABELS.map((_, h) => {
              const pct = lookup.get(`${d}-${h}`) ?? 0;
              return (
                <div
                  key={h}
                  title={pct > 0 ? `${day} ${HOUR_LABELS[h]}: ${pct}%` : "Sin datos"}
                  className={`w-8 h-6 m-px rounded-sm flex items-center justify-center ${pct === 0 ? "bg-muted" : ""}`}
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
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <span>Bajo</span>
          <div
            className="h-3 w-32 rounded-sm"
            style={{ background: "linear-gradient(to right, hsl(120 70% 60%), hsl(60 70% 60%), hsl(0 70% 60%))" }}
          />
          <span>Alto</span>
        </div>
      </div>
    </div>
  );
}
