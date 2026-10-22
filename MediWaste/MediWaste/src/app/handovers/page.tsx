"use client"
import { dataStore } from "@/lib/data-store";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { ArrowLeftRight, Plus, Search, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDataStoreVersion } from "@/lib/use-data-store";

export default function HandoversPage() {
  useDataStoreVersion();
  const donations = dataStore.listDonations();
  const handovers: Array<{ donation: any; items: any[] }> = donations
    .filter((d) => Array.isArray(d.handoverChain) && d.handoverChain.length)
    .map((d) => ({ donation: d, items: d.handoverChain ?? [] }));

  const [recordDonationId, setRecordDonationId] = useState("");
  const [toUid, setToUid] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const donationsWithHandovers = donations.filter((d) => d.handoverChain && d.handoverChain.length > 0);
  const donationsWithoutHandovers = donations.filter((d) => !d.handoverChain || d.handoverChain.length === 0);

  function recordHandover() {
    const donation = dataStore.getDonation(recordDonationId);
    if (!donation) return;
    const last = donation.handoverChain && donation.handoverChain.length ? donation.handoverChain[donation.handoverChain.length - 1] : null;
    const newHandover = {
      id: `ho-${Date.now()}`,
      fromUid: last ? last.toUid : "current-user",
      toUid: toUid || "current-user",
      note: note.trim() || "Handover recorded",
      at: new Date(),
    };
    dataStore.updateDonation(donation.id, {
      handoverChain: [...(donation.handoverChain ?? []), newHandover],
      auditHistory: [{ event: "handover_recorded", actorUid: "current-user", detail: `Handover to ${newHandover.toUid}`, at: new Date() }],
    });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  }

  return (
    <>
      <PageHeading
        title="Handovers"
        description="Chain-of-custody records and handover confirmation."
        actions={
          <Button className="gap-1.5" onClick={recordHandover} disabled={!recordDonationId || !toUid || submitted}>
            <Plus className="h-4 w-4" /> Record handover
          </Button>
        }
      />

      {/* Record handover form */}
      <Card className="mb-8">
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Record a new handover</h3>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Donation</label>
              <Select value={recordDonationId} onChange={(e) => setRecordDonationId(e.target.value)}>
                <option value="">Select a donation…</option>
                {donationsWithoutHandovers.concat(donationsWithHandovers).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.packageInfo?.description ?? "No description"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Hand over to (identifier)</label>
              <Input value={toUid} onChange={(e) => setToUid(e.target.value)} placeholder="e.g. user-review-1" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-slate-500">Note (optional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for handover" />
            </div>
            <Button
              className="shrink-0"
              disabled={!recordDonationId || !toUid || submitted}
              onClick={recordHandover}
            >
              {submitted ? "Recorded" : "Confirm handover"}
            </Button>
          </div>
          {submitted && (
            <p className="mt-2 text-xs text-green-600">Handover recorded. Refresh the list below.</p>
          )}
        </CardContent>
      </Card>

      {/* Handovers list */}
      {handovers.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No handovers recorded"
          description="Record a handover above to begin tracking chain of custody."
        />
      ) : (
        <div className="space-y-6">
          {handovers.map(({ donation, items }) => (
            <Card key={donation.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <div>
                  <Link
                    href={`/donations/${donation.code}`}
                    className="text-sm font-semibold text-medical-700 hover:text-medical-800"
                  >
                    {donation.code}
                  </Link>
                  <p className="text-xs text-slate-500">{donation.packageInfo?.description ?? "No description"}</p>
                </div>
                <Badge variant="secondary">{items.length} handover{items.length === 1 ? "" : "s"}</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.map((h, i) => (
                    <div key={h.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <ArrowLeftRight className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {h.fromUid} → {h.toUid}
                        </p>
                        {h.note && <p className="text-slate-600">{h.note}</p>}
                        <p className="mt-0.5 text-xs text-slate-500">
                          {new Date(h.at as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
