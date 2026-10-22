"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, FlaskConical, Radio, HeartPulse } from "lucide-react";
import { getHudState, subscribeHud, type StationHudState } from "@/lib/sim/store";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { DiagnosticsPanel, TelemetryStack } from "@/components/hud/panels";
import { SerialFeedCard, KpiTicker } from "@/components/hud/serial-feed";
import { WorkflowStrip } from "@/components/hud/panels";
import { SimBadge } from "@/components/sim/sim-badge";

const SPRING = { type: "spring", stiffness: 260, damping: 25 } as const;

// WebGL scene — client-only, never SSR the canvas.
const HeroScene = dynamic(() => import("@/components/3d/hero-visualization"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="font-mono text-xs text-slate-600">initialising hologram…</div>
    </div>
  ),
});

export default function HomePage() {
  const [hud, setHud] = useState<StationHudState>(() => getHudState());
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const unsub = subscribeHud(setHud);
    return () => unsub();
  }, []);

  const dots = [0, 1, 2].map((i) => (
    <span
      key={i}
      className={`h-1.5 w-1.5 rounded-full ${hud.online ? "animate-pulse-dot" : ""}`}
      style={{
        backgroundColor: hud.simulated && hud.online ? "#FFB454" : i === 1 ? "#00FF9D" : "#00F0FF",
        opacity: hud.online ? 1 : 0.3,
        animationDelay: `${i * 0.3}s`,
      }}
    />
  ));

  return (
    <div>
      {/*------------- hero -------------*/}
      <section className="grid gap-6 lg:grid-cols-[45fr_55fr]">
        {/* Left column — value proposition */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="flex flex-col justify-center"
        >
          <p className="font-mono text-lg tracking-wide text-cyan-200/80">
            Trace, Screen, and Save.
          </p>
          <h1 className="mt-2 font-grotesk text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            The Hardware-Integrated Medicine Donation Screening
            <span className="bg-gradient-to-r from-neon-cyan to-neon-green bg-clip-text text-transparent">
              {" & "}
            </span>
            Traceability System.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-400">
            Bridge the gap between physical intake and secure cloud software.
            MedWaste VerifyPoint leverages IoT hardware, ESP32 firmware, and Cloud
            Firestore to verify, track, and process unused medicines safely.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/overview"
              className="brackets inline-flex items-center gap-2 rounded-lg border border-neon-cyan/60 bg-gradient-to-b from-cyan-500/15 to-cyan-500/5 px-5 py-2.5 font-mono text-sm text-neon-cyan shadow-neon-cyan transition-colors hover:bg-cyan-500/25"
            >
              Enter Live Portal <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/simulator"
              className="brackets inline-flex items-center gap-2 rounded-lg border border-neon-green/50 bg-emerald-500/10 px-5 py-2.5 font-mono text-sm text-neon-green transition-colors hover:bg-emerald-500/20"
            >
              <FlaskConical className="h-4 w-4" /> Launch Simulator Mode
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-2 font-mono text-[11px] text-slate-500">
            <span className="flex gap-1.5" aria-hidden>
              {dots}
            </span>
            Hardware connected:
            <span className={hud.online ? (hud.simulated ? "text-neon-amber" : "text-neon-green") : "text-slate-500"}>
              {hud.online
                ? hud.simulated
                  ? "simulated ESP32 station — synthetic telemetry"
                  : "ESP32 VerifyPoint station via BLE"
                : "no station online yet — start the simulator"}
            </span>
          </div>
        </motion.div>

        {/* Right column — 3D stage */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING}
          className="relative min-h-[460px] overflow-hidden rounded-2xl border border-cyan-500/25"
          style={{
            background:
              "radial-gradient(600px 400px at 60% 20%, rgba(0,240,255,0.08), transparent 70%), radial-gradient(400px 300px at 30% 90%, rgba(0,255,157,0.06), transparent 70%)",
          }}
        >
          <div className="absolute left-3 top-3 z-10 hidden md:block">
            <DiagnosticsPanel simulated={hud.simulated} />
          </div>
          <div className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
            <TelemetryStack />
          </div>
          {/* Static DOM annotations instead of three.js <Html>: the old labels
              were repositioned every frame and forced layout while the canvas
              animated. */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 hidden items-end justify-between gap-2 font-mono text-[9px] md:flex">
            <span className="rounded border border-emerald-400/40 bg-slate-950/85 px-2 py-1 text-emerald-300">
              ultrasonic D4/D18 · HC-SR04
            </span>
            <span className="rounded border border-pink-400/40 bg-slate-950/85 px-2 py-1 text-pink-300">
              {hud.irActive ? "laser scan · active" : "laser scan · idle"}
            </span>
            <span className="rounded border border-amber-400/40 bg-slate-950/85 px-2 py-1 text-amber-300">
              {hud.lastStatus === "REQUEST_ACCEPTED" && hud.online
                ? "servo D19 · commanded open (unconfirmed)"
                : "servo D19 · closed (fail-safe)"}
            </span>
          </div>
          {/* Only REQUEST_ACCEPTED ever represents a gate command (protocol v1). */}
          <HeroScene
            hud={hud}
            gateOpen={hud.online && hud.lastStatus === "REQUEST_ACCEPTED"}
            reduced={reduced}
          />
        </motion.div>
      </section>

      {/*------------- bottom bento -------------*/}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        aria-label="Telemetry and operations"
        className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      >
        {/* 1 · workflow */}
        <div className="glass-soft flex flex-col p-4">
          <span className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            8-stage donation workflow (5 core nodes)
          </span>
          <WorkflowStrip />
          <p className="mt-2 font-mono text-[9px] leading-4 text-slate-600">
            draft&ensp;→&ensp;registered&ensp;→&ensp;inspection&ensp;→&ensp;review&ensp;→&ensp;handover&ensp;→&ensp;disposition
            · gate interlocked until an authorised reviewer decides
          </p>
        </div>

        {/* 2 · KPIs */}
        <div className="glass-soft p-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            screening &amp; handover kpis
          </span>
          <div className="mt-3 flex gap-6">
            <KpiTicker value={1146} label="packages screened" tone="cyan" />
            <KpiTicker value={327} label="successful handover paths" tone="green" />
          </div>
        </div>

        {/* 3 · serial feed */}
        <SerialFeedCard className="min-h-[190px]" />

        {/* 4 · live telemetry mini */}
        <div className="glass-soft flex flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-neon-cyan">
              live telemetry
            </span>
            {hud.online && hud.simulated && <SimBadge />}
          </div>
          <div className="flex-1" />
          <TelemetryStack />
        </div>
      </motion.section>

      <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-600">
        <Radio className="h-3 w-3" /> esp32 station · ble protocol v1 · firestore
        backend — inject realtime events with the simulation dock (bottom-right).
        <HeartPulse className="h-3 w-3" /> simulated telemetry is always flagged
        <SimBadge className="scale-90" /> amber.
      </div>
    </div>
  );
}
