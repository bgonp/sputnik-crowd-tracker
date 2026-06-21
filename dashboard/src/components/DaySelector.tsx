"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DAY_LABELS } from "@/lib/labels";
import { dateChangeHref } from "@/lib/venue-routing";
import { buildCalendarMonth, monthOf, shiftMonth } from "@/lib/calendar";

interface Props {
  selected: string; // YYYY-MM-DD Madrid date currently plotted
  today: string; // YYYY-MM-DD; picking it drops `?date` (the live default)
  minDate: string; // earliest selectable day (today is the latest)
  // Madrid dates that have data; past days outside it are disabled (empty).
  availableDates: string[];
  triggerLabel: string; // "Hoy" or e.g. "Sáb 20 jun"
}

/**
 * Picks which day the line chart plots, via a small month calendar bounded to
 * the selectable window. Selecting a day re-renders the chart through the
 * `?date=` search param (server-fetched, cache-keyed) rather than client state.
 */
export function DaySelector({ selected, today, minDate, availableDates, triggerLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOf(selected));

  const available = useMemo(() => new Set(availableDates), [availableDates]);
  const month = buildCalendarMonth({
    ...view,
    selected,
    today,
    min: minDate,
    max: today,
    available,
  });

  function pick(date: string) {
    setOpen(false);
    if (date === selected) return;
    const href = dateChangeHref(
      pathname,
      new URLSearchParams(searchParams.toString()),
      date,
      today
    );
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reopen always lands on the selected day's month, not where you left off.
        if (next) setView(monthOf(selected));
      }}
    >
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <CalendarDays />
        {triggerLabel}
        {isPending && <Loader2 className="animate-spin" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        <div className="flex items-center justify-between gap-2 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mes anterior"
            disabled={!month.canGoPrev}
            onClick={() => setView(shiftMonth(view.year, view.month, -1))}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium capitalize">{month.label}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mes siguiente"
            disabled={!month.canGoNext}
            onClick={() => setView(shiftMonth(view.year, view.month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {DAY_LABELS.map((d) => (
            <span key={d} className="py-1 text-[0.7rem] font-medium text-muted-foreground">
              {d}
            </span>
          ))}
          {month.weeks.flat().map((cell) => (
            <button
              key={cell.date}
              type="button"
              disabled={cell.disabled}
              aria-label={cell.date}
              aria-current={cell.isToday ? "date" : undefined}
              onClick={() => pick(cell.date)}
              className={cn(
                "size-8 rounded-md text-sm tabular-nums transition-colors",
                !cell.inMonth && "text-muted-foreground/40",
                cell.disabled
                  ? "pointer-events-none opacity-40"
                  : cell.isSelected
                    ? "bg-primary font-medium text-primary-foreground"
                    : "hover:bg-muted",
                cell.isToday && !cell.isSelected && "ring-1 ring-primary/50"
              )}
            >
              {cell.day}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
