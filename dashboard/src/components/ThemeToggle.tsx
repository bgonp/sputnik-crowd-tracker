"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEMES = ["system", "light", "dark"] as const;

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // next-themes hydration guard: the theme is unknown during SSR, so we render
  // a stable placeholder until the component has mounted on the client. This
  // one-time mount flag is the library-recommended pattern; the lint rule's
  // concern about cascading renders doesn't apply to a single setState.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Tema" disabled><Monitor /></Button>;
  }

  const current = (THEMES.includes(theme as (typeof THEMES)[number]) ? theme : "system") as (typeof THEMES)[number];
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  const Icon = ICONS[current];

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(next)} aria-label={`Switch to ${next} theme`}>
      <Icon />
    </Button>
  );
}
