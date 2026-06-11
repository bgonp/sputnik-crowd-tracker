"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Venue } from "@/lib/queries";

export function VenueSelector({ venues, selectedId }: { venues: Venue[]; selectedId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("venue", e.target.value);
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={String(selectedId)}
      onChange={onChange}
      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {venues.map((v) => (
        <option key={String(v.id)} value={String(v.id)}>
          {String(v.name).replace(" Principal", "")}
        </option>
      ))}
    </select>
  );
}
