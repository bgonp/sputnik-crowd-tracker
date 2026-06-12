"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export type Unit = "percentage" | "absolute";

export function UnitToggle({ unit }: { unit: Unit }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (unit === "percentage") {
      params.set("unit", "absolute");
    } else {
      params.delete("unit");
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <Button variant="outline" size="icon" onClick={toggle} aria-label="Cambiar unidades" title={unit === "percentage" ? "Mostrar personas" : "Mostrar porcentaje"}>
      <span className="text-xs font-medium">{unit === "percentage" ? "%" : "#"}</span>
    </Button>
  );
}
