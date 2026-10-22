"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * High-contrast marker placed on every dashboard card, log line and diagram
 * generated from the simulator engine — synthetic data must never blend in
 * with a live feed.
 */
export function SimBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="warning"
      className={cn(
        "border border-neon-amber/60 bg-amber-500/15 font-mono text-[10px] font-semibold tracking-widest text-neon-amber uppercase",
        className
      )}
    >
      Simulated data
    </Badge>
  );
}
