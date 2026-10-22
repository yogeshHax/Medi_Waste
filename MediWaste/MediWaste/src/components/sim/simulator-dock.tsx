"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical, X, Zap, Wifi, WifiOff, Package, PackageOpen, Timer, Unplug, FileWarning, Copy, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimBadge } from "@/components/sim/sim-badge";
import { emitSimEvent, isDuplicateMessage } from "@/lib/sim/store";

const SPRING = { type: "spring", stiffness: 260, damping: 25 } as const;

const STATION = "station-1";

/** Inject a synthetic event through the same event bus used by HUD/telemetry. */
function inject(type: Parameters<typeof emitSimEvent>[0]["type"], note?: string) {
  const msgId = `sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const dup = type === "DUPLICATE_PACKET" ? { frame: undefined, msgId: undefined } : {};
  if (type === "DUPLICATE_PACKET") {
    // Reuse an id we have already registered to prove seq/msg dedupe.
    const probe = `sim-dup-${msgId}`;
    isDuplicateMessage(probe);
    emitSimEvent({ type: "DUPLICATE_PACKET", simulated: true, stationId: STATION, msgId: probe, note: "Retransmitted frame dropped by dedupe window" });
    return;
  }
  emitSimEvent({
    type,
    simulated: true,
    stationId: STATION,
    msgId,
    note,
    ...dup,
  });
}

export function SimulatorDock() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const trigger = {
    stationOn: () => inject("STATION_CONNECT", "Station heartbeat online"),
    stationOff: () => inject("STATION_DISCONNECT", "Heartbeat lost — station shown offline"),
    bleOn: () => inject("BLE_CONNECTED", "Phone paired with ESP32"),
    bleOff: () => inject("BLE_DISCONNECTED", "Phone left BLE range"),
    irPlaced: () => inject("IR_PLACED", "Debounced package-present edge"),
    irRemoved: () => inject("IR_REMOVED", "Package withdrawn from bay"),
    capacity: () => {
      const cm = Number((2.5 + Math.random() * 20).toFixed(1)); // bay depth remainder
      const fill = Math.round(Math.min(100, Math.max(0, ((22 - cm) / 20) * 100)));
      // One frame = one HUD/feed update. Do not double-publish a synthetic sample.
      emitSimEvent({
        type: "ULTRASONIC_SAMPLE",
        simulated: true,
        stationId: STATION,
        distanceCm: cm,
        fillPercent: fill,
        note: `distanceCm ${cm}, capacity ${fill}%`,
      });
    },
  };

  const fault = {
    invalidDistance: () => inject("INVALID_DISTANCE", "0.9 cm sample — flagged SENSOR_FAULT, HUD distance cleared"),
    gateAck: () => inject("GATE_ACK_TIMEOUT", "GATE_OPEN unanswered after 3000 ms — gate stays CLOSED"),
    duplicate: () => inject("DUPLICATE_PACKET"),
    malformed: () => inject("MALFORMED_PAYLOAD", "Frame failed protocol v1 schema"),
    delayed: () => inject("DELAYED_MESSAGE", "Delivery exceeded transport SLA"),
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={SPRING}
            className="glass pointer-events-auto w-80 p-4"
            role="dialog"
            aria-label="Simulation dock"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-neon-cyan" />
                <div className="flex flex-col leading-tight">
                  <span className="font-grotesk text-sm font-semibold text-slate-100">Simulation dock</span>
                  <SimBadge className="mt-0.5" />
                </div>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close simulator dock" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 text-xs">
              <DockSection title="Station & phone">
                <DockBtn icon={<Wifi className="h-3.5 w-3.5" />} label="Connect station" onClick={trigger.stationOn} />
                <DockBtn icon={<WifiOff className="h-3.5 w-3.5" />} label="Disconnect station" onClick={trigger.stationOff} />
                <DockBtn icon={<Unplug className="h-3.5 w-3.5" />} label="Pair / drop BLE" onClick={trigger.bleOn} />
                <DockBtn icon={<Package className="h-3.5 w-3.5" />} label="IR place" onClick={trigger.irPlaced} />
                <DockBtn icon={<PackageOpen className="h-3.5 w-3.5" />} label="IR remove" onClick={trigger.irRemoved} />
                <DockBtn icon={<Gauge className="h-3.5 w-3.5" />} label="Ultrasonic sample" onClick={trigger.capacity} />
              </DockSection>

              <DockSection title="Fault injection">
                <DockBtn icon={<FileWarning className="h-3.5 w-3.5" />} label="Invalid distance" onClick={fault.invalidDistance} />
                <DockBtn icon={<Timer className="h-3.5 w-3.5" />} label="Gate ACK timeout" onClick={fault.gateAck} />
                <DockBtn icon={<Copy className="h-3.5 w-3.5" />} label="Duplicate packet" onClick={fault.duplicate} />
                <DockBtn icon={<FileWarning className="h-3.5 w-3.5" />} label="Malformed payload" onClick={fault.malformed} />
                <DockBtn icon={<Timer className="h-3.5 w-3.5" />} label="Delayed message" onClick={fault.delayed} />
              </DockSection>

              <Link
                href="/simulator"
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-neon-green/40 bg-neon-green/10 px-3 py-2 font-mono text-xs text-neon-green hover:bg-neon-green/20"
                onClick={() => setOpen(false)}
              >
                Full simulator mode
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto flex items-center gap-2">
        <Button
          onClick={() => {
            setOpen((v) => !v);
            if (!open) router.prefetch("/simulator");
          }}
          className="gap-2 border border-neon-cyan/50 bg-cyan-500/15 font-mono text-xs text-neon-cyan shadow-neon-cyan hover:bg-cyan-500/25"
          aria-expanded={open}
        >
          {open ? "Close simulator" : "Launch simulator"}
          <Zap className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DockSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">{title}</p>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  );
}

function DockBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-cyan-500/25 bg-slate-900/60 px-2 py-1.5 text-left font-mono text-[11px] text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-neon-cyan"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
