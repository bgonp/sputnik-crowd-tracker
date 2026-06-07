"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Venue } from "@/lib/queries";

export function VenueSelector({ venues, selectedId }: { venues: Venue[]; selectedId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("venue", value);
    router.push(`?${params.toString()}`);
  }

  return (
    <Select value={String(selectedId)} onValueChange={onChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select venue" />
      </SelectTrigger>
      <SelectContent>
        {venues.map((v) => (
          <SelectItem key={v.id} value={String(v.id)}>
            {v.name.replace(" Principal", "")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
