"use client";

import { useEffect, useRef, useState } from "react";
import { SimBadge } from "@/components/sim/sim-badge";
import {
  recentSimEvents,
  subscribeSimEvents,
  type SimEvent,
} from "@/lib/sim/store";

const fmt = (at: number) => {
  const d = new Date(at);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
};

export function SerialFeedCard({ className }: { className?: string }) {
  const [events, setEvents] = useState<SimEvent[]>(() => recentSimEvents().slice(0, 8));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribeSimEvents((e) => {
        setEvents((prev) => [e, ...prev].slice(0, 8));
      }),
    []
  );

  return (
    <div className={`glass-soft flex h-full flex-col p-3 ${className ?? ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-neon-green">
          live station feed · protocol v1
        </span>
        {events.some((e) => e.simulated) && <SimBadge />}
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-hidden font-mono text-[10px] leading-5">
        {events.length === 0 && (
          <p className="text-slate-600">
            no events yet — open the simulator dock and inject a station event.
          </p>
        )}
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-2 truncate">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" aria-hidden data-testid="feed-dot" />
            <span className="shrink-0 text-slate-500">{fmt(e.at)}</span>
            <span
              className={`truncate ${
                e.type.includes("FAULT") ||
                e.type.startsWith("INVALID") ||
                e.type.startsWith("MALFORMED") ||
                e.type === "GATE_ACK_TIMEOUT" ||
                e.type === "DUPLICATE_PACKET" ||
                e.type === "DELAYED_MESSAGE"
                  ? "text-neon-amber"
                  : "text-emerald-300"
              }`}
            >
              {e.type}
              {e.status ? ` · ${e.status}` : ""}
              {e.note ? ` — ${e.note}` : ""}
            </span>
            {e.simulated && <SimBadge className="ml-auto shrink-0 scale-95" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- number ticker KPI */

/** 4-digit odometer-style count-up for KPI values. */
export function KpiTicker({
  value,
  label,
  tone = "cyan",
}: {
  value: number;
  label: string;
  tone?: "cyan" | "green";
}) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const t0 = performance.now();
    const dur = 900;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  const color = tone === "green" ? "text-neon-green" : "text-neon-cyan";
  const bar = tone === "green" ? "bg-neon-green" : "bg-neon-cyan";

  return (
    <div className="flex-1">
      <p className={`font-grotesk text-3xl font-bold tabular-nums ${color}`}>
        {display.toLocaleString()}
      </p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full w-2/3 rounded-full ${bar} opacity-70`} />
      </div>
    </div>
  );
}
