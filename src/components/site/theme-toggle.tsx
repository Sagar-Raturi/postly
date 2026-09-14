"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Which icon shows is decided in CSS from the `.dark` class next-themes puts
 * on <html>, so there is no mount flag and no hydration mismatch to guard.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun aria-hidden className="size-4 text-muted-foreground dark:hidden" />
      <Moon
        aria-hidden
        className="hidden size-4 text-muted-foreground dark:block"
      />
    </Button>
  );
}
