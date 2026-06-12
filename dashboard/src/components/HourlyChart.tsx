"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Unit } from "@/components/UnitToggle";
import type { HourlyBar } from "@/lib/queries";

interface Props {
  data: HourlyBar[];
  unit: Unit;
  currentHour?: number;
  currentPct?: number;
  currentOccupancy?: number;
}

interface BarShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

export function HourlyChart({ data, unit, currentHour, currentPct, currentOccupancy }: Props) {
  const isAbsolute = unit === "absolute";

  const chartData = data.map((d) => ({
    hour: `${String(d.hour).padStart(2, "0")}h`,
    value: isAbsolute ? d.avgOccupancy : d.avgPercentage,
    pct: d.avgPercentage,
    abs: d.avgOccupancy,
    isCurrent: d.hour === currentHour,
  }));

  const currentValue = isAbsolute ? currentOccupancy : currentPct;

  const currentHourAvgPct = data.find((d) => d.hour === currentHour)?.avgPercentage;
  const statusText = (() => {
    if (currentPct === undefined || currentHourAvgPct === undefined) return undefined;
    if (currentHourAvgPct === 0) return undefined;
    const diff = currentPct - currentHourAvgPct;
    if (diff > 20)  return "Muy por encima de la media";
    if (diff > 10)  return "Por encima de la media";
    if (diff > 4)   return "Un poco por encima de la media";
    if (diff > -4)  return "En torno a la media";
    if (diff > -10) return "Un poco por debajo de la media";
    if (diff > -20) return "Por debajo de la media";
    return "Muy por debajo de la media";
  })();

  const renderBar = (props: BarShapeProps) => {
    const { x, y, width, height, index } = props;
    const entry = chartData[index];
    if (!entry || height <= 0) return <g />;

    if (!entry.isCurrent || currentValue === undefined || entry.value === 0) {
      return (
        <rect x={x} y={y} width={width} height={height}
          fill="var(--chart-3)" opacity={0.75} rx={2} ry={2} />
      );
    }

    const overlayHeight = Math.round((currentValue / entry.value) * height);
    const overlayY = y + height - overlayHeight;

    const annotationX = x + width / 2;
    const annotationBaseY = Math.min(y, overlayY);
    const lineLen = 22;

    return (
      <g>
        <rect x={x} y={y} width={width} height={height}
          fill="var(--chart-3)" opacity={1} rx={2} ry={2} />
        <rect x={x} y={overlayY} width={width} height={overlayHeight}
          fill="var(--primary)" opacity={0.5} rx={2} ry={2} />
        {statusText && (
          <>
            <line
              x1={annotationX} y1={annotationBaseY - 3}
              x2={annotationX} y2={annotationBaseY - 3 - lineLen}
              stroke="currentColor" strokeWidth={1} strokeDasharray="3,2" opacity={0.4}
            />
            <circle cx={annotationX} cy={annotationBaseY - 3} r={2}
              fill="currentColor" opacity={0.4} />
            <text
              x={annotationX} y={annotationBaseY - 3 - lineLen - 5}
              textAnchor="middle" fontSize={12} fill="currentColor" opacity={0.8}
              fontStyle="italic"
            >
              {statusText}
            </text>
          </>
        )}
      </g>
    );
  };


  return (
    <ChartContainer config={{ value: { label: "Aforo medio", color: "var(--chart-3)" } }} className="h-52 w-full [&>div>svg]:overflow-visible">
      <BarChart data={chartData} margin={{ top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
        <YAxis unit={isAbsolute ? "" : "%"} domain={isAbsolute ? [0, "auto"] : [0, 100]} tick={{ fontSize: 11 }} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(_value, _name, item) => {
                const { pct, abs } = item.payload as { pct: number; abs: number };
                return <span className="font-mono font-medium tabular-nums">{pct}% · {abs} pers.</span>;
              }}
            />
          }
        />
        <Bar dataKey="value" shape={renderBar as any} />
      </BarChart>
    </ChartContainer>
  );
}
