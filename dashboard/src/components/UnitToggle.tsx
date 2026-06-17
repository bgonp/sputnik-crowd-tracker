"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export type Unit = "percentage" | "absolute";

export function UnitToggle({ unit }: { unit: Unit }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (unit === "percentage") {
      params.set("unit", "absolute");
    } else {
      params.delete("unit");
    }
    const query = params.toString();
    // Keep the venue path; only carry a query string when there is one.
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Button variant="outline" size="icon" onClick={toggle} aria-label="Cambiar unidades" title={unit === "percentage" ? "Mostrar personas" : "Mostrar porcentaje"}>
      <span className="text-xs font-medium">{unit === "percentage" ? "%" : "#"}</span>
    </Button>
  );
}
