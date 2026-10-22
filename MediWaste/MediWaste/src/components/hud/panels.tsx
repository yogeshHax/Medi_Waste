"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Bluetooth, Boxes, Waves } from "lucide-react";
import { SimBadge } from "@/components/sim/sim-badge";
import { getHudState, subscribeHud, type StationHudState } from "@/lib/sim/store";

const SPRING = { type: "spring", stiffness: 260, damping: 25 } as const;

/* --------------------------------------------------- live sparkline + HUD */

export function DiagnosticsPanel({ simulated }: { simulated: boolean }) {
  const [hud, setHud] = useState<StationHudState>(() => getHudState());
  const [series, setSeries] = useState<number[]>(Array.from({ length: 28 }, () => 0.2));
  const phaseRef = useRef(0);

  useEffect(() => subscribeHud(setHud), []);

  useEffect(() => {
    if (!hud.online) return setSeries(Array.from({ length: 28 }, () => 0.05));
    const t = setInterval(() => {
      phaseRef.current += 0.35;
      const ir = hud.irActive ? 0.35 : 0;
      const fill = (hud.fillPercent ?? 30) / 100;
      // Deterministic waveform derived from live values — no random noise that
      // would falsely suggest a sensor signal when the station is idle.
      const next = Math.max(
        0.04,
        Math.min(1, 0.38 + ir + fill * 0.32 + 0.12 * Math.sin(phaseRef.current))
      );
      setSeries((prev) => [...prev.slice(1), next]);
    }, 450);
    return () => clearInterval(t);
  }, [hud.online, hud.irActive, hud.fillPercent]);

  const path = series
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * 7} ${34 - v * 30}`)
    .join(" ");

  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={SPRING}
      className="w-44 space-y-2 rounded-xl border border-cyan-500/30 bg-slate-950/85 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.45)]"
      aria-label="Wireframe diagnostics panel"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-neon-cyan">
          <Activity className="h-3 w-3" /> diagnostics
        </span>
        {simulated && <SimBadge />}
      </div>
      {/* wireframe deco */}
      <svg viewBox="0 0 110 52" className="h-12 w-full text-neon-cyan/40">
        <circle cx="22" cy="26" r="14" fill="none" stroke="currentColor" strokeDasharray="2 3" />
        <circle cx="22" cy="26" r="9" fill="none" stroke="currentColor" strokeDasharray="1 2" />
        <path d="M42 16 h20 M42 26 h28 M42 36 h16" stroke="currentColor" strokeDasharray="2 3" />
        <path d="M70 12 v28" stroke="currentColor" strokeDasharray="2 3" />
      </svg>
      <svg viewBox="0 0 196 36" className="h-9 w-full">
        <path d={path} fill="none" stroke="#00F0FF" strokeWidth="1.5" />
      </svg>
      <div className="font-mono text-[10px] text-slate-400">
        ir: <span className={hud.irActive ? "text-neon-green" : "text-slate-500"}>{hud.irActive ? "ACTIVE" : "idle"}</span>
        {" · "}
        dist: <span className="text-neon-cyan">{hud.distanceCm !== null ? `${hud.distanceCm.toFixed(1)}cm` : "—"}</span>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------- telemetry stack */

export function TelemetryCard({
  icon,
  label,
  value,
  tone = "cyan",
  progress,
  simulated,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "cyan" | "green" | "amber";
  progress?: number | null;
  simulated: boolean;
}) {
  const toneColor = tone === "green" ? "text-neon-green" : tone === "amber" ? "text-neon-amber" : "text-neon-cyan";
  const barColor = tone === "green" ? "bg-neon-green" : tone === "amber" ? "bg-neon-amber" : "bg-neon-cyan";
  return (
    <div className="relative rounded-xl border border-cyan-500/20 bg-slate-950/85 p-3">
      {simulated && <SimBadge className="absolute right-2 top-2" />}
      <div className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest ${toneColor}`}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1.5 font-grotesk text-sm font-semibold text-slate-100">{value}</p>
      {typeof progress === "number" && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            transition={SPRING}
          />
        </div>
      )}
    </div>
  );
}

/** Vertical stack of live telemetry cards bound to real/sim station state. */
export function TelemetryStack() {
  const [hud, setHud] = useState<StationHudState>(() => getHudState());
  useEffect(() => subscribeHud(setHud), []);

  const online = hud.online;
  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={SPRING}
      className="flex flex-col gap-2"
      aria-label="Live telemetry"
    >
      <TelemetryCard
        icon={<Waves className="h-3 w-3" />}
        label={hud.irActive ? "scanning package (ir active)" : "package bay idle"}
        value={hud.irActive ? "IR ACTIVE" : "no package"}
        tone={hud.irActive ? "cyan" : "amber"}
        simulated={online && hud.simulated}
      />
      <TelemetryCard
        icon={<Bluetooth className="h-3 w-3" />}
        label={online ? (hud.bleConnected ? "ble connected (esp32 gatt)" : "station online · ble idle") : "station offline"}
        value={online ? (hud.bleConnected ? "BLE LINKED" : "ONLINE") : "OFFLINE"}
        tone={online ? "green" : "amber"}
        simulated={online && hud.simulated}
      />
      <TelemetryCard
        icon={<Boxes className="h-3 w-3" />}
        label="capacity"
        value={hud.fillPercent !== null ? `${Math.round(hud.fillPercent)}%` : "no reading"}
        tone="green"
        progress={hud.fillPercent}
        simulated={hud.fillPercent !== null && hud.simulated}
      />
    </motion.div>
  );
}

/* ---------------------------------------------------------- workflow nodes */

const NODES = [
  { label: "Registration", icon: "⊞" },
  { label: "Detection", icon: "◉" },
  { label: "Inspection", icon: "⚙" },
  { label: "Verification", icon: "✓" },
  { label: "Disposition", icon: "⇒" },
] as const;

export function WorkflowStrip() {
  return (
    <div className="flex items-center justify-center gap-0 overflow-x-auto py-1">
      {NODES.map((n, i) => (
        <div key={n.label} className="flex items-center shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ...SPRING, delay: i * 0.07 }}
            className="group flex flex-col items-center"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg border font-mono text-base transition-all group-hover:scale-105"
              style={{
                borderColor: i % 2 === 0 ? "rgba(0,240,255,0.5)" : "rgba(0,255,157,0.5)",
                color: i % 2 === 0 ? "#00F0FF" : "#00FF9D",
                boxShadow: `0 0 14px ${i % 2 === 0 ? "rgba(0,240,255,0.25)" : "rgba(0,255,157,0.2)"}`,
              }}
              aria-hidden
            >
              {n.icon}
            </div>
            <span className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
              {n.label}
            </span>
          </motion.div>
          {i < NODES.length - 1 && (
            <svg width="34" height="12" viewBox="0 0 34 12" className="shrink-0" aria-hidden>
              <path
                d="M2 6 C 12 1, 22 11, 30 6"
                fill="none"
                stroke={i % 2 === 0 ? "rgba(0,240,255,0.6)" : "rgba(0,255,157,0.6)"}
                strokeWidth="1.5"
              />
              <circle cx="30" cy="6" r="2" fill={i % 2 === 0 ? "#00F0FF" : "#00FF9D"} />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
