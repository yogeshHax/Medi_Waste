"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-context";
import { SimulatorDock } from "@/components/sim/simulator-dock";
import { getHudState, subscribeHud, type StationHudState } from "@/lib/sim/store";
import {
  ShieldCheck,
  LayoutDashboard,
  Package,
  Radio,
  FlaskConical,
  ArrowLeftRight,
  FileSpreadsheet,
  ClipboardList,
  Search,
  Receipt,
  Settings,
  Bluetooth,
} from "lucide-react";

/**
 * Primary pill navigation — maps the spec's six named views onto the
 * existing page implementations (remap, do not duplicate).
 */
const primaryNav = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/donations", label: "Live Dashboard", icon: Package },
  { href: "/station", label: "Station Monitoring", icon: Radio },
  { href: "/simulator", label: "Simulation Mode", icon: FlaskConical },
  { href: "/handovers", label: "Handovers", icon: ArrowLeftRight },
  { href: "/reports", label: "Audit Trails", icon: FileSpreadsheet },
];

/** Secondary operational routes kept accessible (dense mono links). */
const secondaryNav = [
  { href: "/donations/new", label: "new intake", icon: ClipboardList },
  { href: "/review", label: "review queue", icon: Search },
  { href: "/dispositions", label: "dispositions", icon: Receipt },
  { href: "/station/ble", label: "ble link", icon: Bluetooth },
  { href: "/settings", label: "settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut, loading, role, demoMode } = useAuth();
  // Online is derived from the same station heartbeat/simulator store as the
  // 3D stage and telemetry cards — never from demo mode or a hard-coded value.
  const [hud, setHud] = useState<StationHudState>(() => getHudState());

  useEffect(() => subscribeHud(setHud), []);

  const online = hud.online;

  return (
    <div className="flex h-screen flex-col bg-obsidian-950 text-slate-100">
      {/* ---------------- Top navigation bar ---------------- */}
      <header className="flex items-center gap-4 border-b border-cyan-500/20 bg-obsidian-900/70 px-4 py-2.5 backdrop-blur-md">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon-green/40 bg-slate-900/70 text-neon-green shadow-neon-green">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-grotesk text-sm font-bold tracking-wide text-neon-green">
              MedWaste
            </span>
            <span className="font-grotesk text-sm font-bold tracking-wide text-neon-cyan">
              VerifyPoint
            </span>
          </span>
        </Link>

        {/* Pill nav */}
        <nav
          aria-label="Primary"
          className="mx-auto hidden items-center gap-1 rounded-full border border-cyan-500/25 bg-slate-900/60 px-1.5 py-1 lg:flex backdrop-blur"
        >
          {primaryNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/overview" && pathname.startsWith(item.href + "/")) ||
              (item.href === "/donations" && pathname.startsWith("/donations/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "text-neon-cyan"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-px h-px bg-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.8)] rounded-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Status pill — honest: reflects heartbeat/sim state */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              online
                ? hud.simulated
                  ? "border-neon-amber/40 bg-amber-500/10 text-neon-amber"
                  : "border-neon-green/40 bg-emerald-500/10 text-neon-green"
                : "border-slate-600/50 bg-slate-800/50 text-slate-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                online
                  ? hud.simulated
                    ? "animate-pulse-dot bg-neon-amber"
                    : "animate-pulse-dot bg-neon-green"
                  : "bg-slate-500"
              }`}
            />
            {online ? (hud.simulated ? "Simulation Online" : "System Online") : "Station Offline"}
          </span>

          {/* Sim CTA */}
          <Link
            href="/simulator"
            className="hidden rounded-lg border border-neon-cyan/50 bg-cyan-500/10 px-3 py-1.5 font-mono text-xs text-neon-cyan shadow-neon-cyan transition-colors hover:bg-cyan-500/20 sm:block"
          >
            Launch Simulator
          </Link>

          {/* User */}
          <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
            {user ? (
              <>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-neon-cyan/40 bg-slate-900/70 font-grotesk text-xs text-neon-cyan">
                  {(user.displayName?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="hidden flex-col leading-tight md:flex">
                  <span className="max-w-[10rem] truncate text-[11px] font-medium text-slate-200">
                    {user.email}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {role ?? "viewer"}
                    {demoMode ? " · demo" : ""}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  disabled={loading}
                  className="rounded-md px-2 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                >
                  sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md border border-cyan-500/40 px-3 py-1.5 font-mono text-[11px] text-neon-cyan hover:bg-cyan-500/10"
              >
                sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Secondary dense nav row */}
      <div className="flex items-center gap-3 overflow-x-auto border-b border-slate-800/80 bg-obsidian-950/80 px-4 py-1.5 backdrop-blur">
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-600 shrink-0">
          routes:
        </span>
        {secondaryNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1 font-mono text-[11px] transition-colors ${
                active ? "text-neon-cyan" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <item.icon className="h-3 w-3" />
              {item.label}
            </Link>
          );
        })}
        <nav aria-label="Primary mobile" className="lg:hidden ml-auto flex gap-2 shrink-0">
          {primaryNav.slice(0, 3).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-cyan-500/30 px-2 py-1 font-mono text-[10px] text-slate-300"
            >
              {item.label.split(" ")[0]}
            </Link>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      <SimulatorDock />
    </div>
  );
}
