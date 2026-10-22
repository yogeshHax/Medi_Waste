"use client";

import { dataStore } from "@/lib/data-store";
import { useDataStoreVersion } from "@/lib/use-data-store";
import { PageHeading } from "@/components/page-heading";
import { DonationCard } from "@/components/donation-ui";
import { EmptyState } from "@/components/empty-state";
import {
  ClipboardList,
  AlertTriangle,
  Radio,
  Clock,
  CheckCircle2,
  Activity,
  TrendingUp,
ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function OverviewPage() {
  // Client component bound to the same store every other page writes to, so
  // counters and the recent list reflect new intakes immediately.
  useDataStoreVersion();
  const donations = dataStore.listDonations();
  const pendingInspection = donations.filter((d) => d.status === "awaiting_inspection" || d.status === "inspection_in_progress");
  const withOpenDiscrepancies = donations.filter((d) => d.discrepancies?.some((d) => d.status === "open"));
  const stations = dataStore.listStations();
  const onlineStations = stations.filter((s) => s.online);
  const recent = donations.slice(0, 5);

  const stats = [
    {
      label: "Total donations",
      value: donations.length,
      icon: ClipboardList,
      color: "text-medical-700 bg-medical-50 hover:bg-medical-100",
    },
    {
      label: "Pending inspection",
      value: pendingInspection.length,
      icon: Clock,
      color: "text-amber-700 bg-amber-50 hover:bg-amber-100",
    },
    {
      label: "Open discrepancies",
      value: withOpenDiscrepancies.length,
      icon: AlertTriangle,
      color: "text-red-700 bg-red-50 hover:bg-red-100",
    },
    {
      label: "Stations online",
      value: onlineStations.length,
      icon: Radio,
      color: "text-green-700 bg-green-50 hover:bg-green-100",
    },
  ];

  return (
    <>
      <PageHeading
        title="Overview"
        description="Operational snapshot across donations, reviews, and stations."
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: recent donations + station status */}
      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* Recent donations */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent donations</h2>
            <Link href="/donations">
              <Button variant="ghost" size="sm" className="gap-1">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No donations yet"
              description="Register the first package to see it here."
              action={
                <Link href="/donations/new">
                  <Button size="sm">Register a package</Button>
                </Link>
              }
            />
          ) : (
            <div className="mt-4 space-y-3">
              {recent.map((d) => (
                <Link key={d.id} href={`/donations/${d.code}`}>
                  <DonationCard donation={d} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Station status */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Station status</h2>
          <div className="mt-4 space-y-3">
            {stations.map((s) => {
              const location = dataStore.getLocation(s.locationId);
              return (
                <Link key={s.id} href="/station" className="block">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-3 w-3 rounded-full ${s.online ? "bg-green-500" : "bg-slate-300"}`}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500">
                          {location?.name ?? "Unknown location"}
                          {s.serialNumber ? ` · ${s.serialNumber}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.online ? "success" : "secondary"}>
                        {s.online ? "Online" : "Offline"}
                      </Badge>
                      <div
                        className={`flex h-2 flex-center w-12 rounded-full border border-slate-200 bg-slate-50 p-0.5 ${s.gateState === "open" ? "bg-green-500" : "bg-slate-200"}`}
                      >
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${s.gateState === "open" ? "bg-white" : "bg-slate-300"}`}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Watchlist: packages needing review */}
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-medium text-slate-900">Needs attention</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {withOpenDiscrepancies.length} package{withOpenDiscrepancies.length === 1 ? "" : "s"} with open discrepancies
              {pendingInspection.length > 0 && `, ${pendingInspection.length} awaiting or in inspection`}.
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/donations/new">
          <Button className="gap-2">
            <ClipboardList className="h-4 w-4" /> New intake
          </Button>
        </Link>
        <Link href="/review">
          <Button variant="outline" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Review queue
          </Button>
        </Link>
        <Link href="/station">
          <Button variant="outline" className="gap-2">
            <Radio className="h-4 w-4" /> Station console
          </Button>
        </Link>
        <Link href="/reports">
          <Button variant="ghost" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Reports
          </Button>
        </Link>
      </div>
    </>
  );
}