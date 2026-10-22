"use client"
import { dataStore } from "@/lib/data-store";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Receipt, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDataStoreVersion } from "@/lib/use-data-store";

const DISPOSITION_LABELS: Record<string, string> = {
  reuse_eligible: "Reuse eligible",
  destroy: "Destroy",
  return_to_supplier: "Return to supplier",
  held: "Held",
  other: "Other",
};

export default function DispositionsPage() {
  useDataStoreVersion();
  const donations = dataStore.listDonations();
  const withDisposition = donations.filter((d) => d.disposition);
  const [recordDonationId, setRecordDonationId] = useState("");
  const [type, setType] = useState("held");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function recordDisposition() {
    const donation = dataStore.getDonation(recordDonationId);
    if (!donation) return;
    dataStore.updateDonation(donation.id, {
      status: "disposition_recorded",
      disposition: {
        type: type as any,
        authorisedByUid: "current-user",
        authorisedAt: new Date(),
        note: note.trim() || undefined,
      },
      auditHistory: [{ event: "disposition_recorded", actorUid: "current-user", detail: `Disposition: ${DISPOSITION_LABELS[type] ?? type}`, at: new Date() }],
    });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  }

  return (
    <>
      <PageHeading
        title="Dispositions"
        description="Final disposition records and authorised actions."
        actions={
          <Button className="gap-1.5" onClick={recordDisposition} disabled={!recordDonationId || submitted}>
            <Plus className="h-4 w-4" /> Record disposition
          </Button>
        }
      />

      {/* Record form */}
      <Card className="mb-8">
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Record a new disposition</h3>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Donation</label>
              <Select
                value={recordDonationId}
                onChange={(e) => setRecordDonationId(e.target.value)}
              >
                <option value="">Select a donation…</option>
                {donations.filter((d) => !d.disposition).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.packageInfo?.description ?? "No description"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Disposition type</label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="reuse_eligible">Reuse eligible</option>
                <option value="destroy">Destroy</option>
                <option value="return_to_supplier">Return to supplier</option>
                <option value="held">Held</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-slate-500">Note (optional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason or next steps" />
            </div>
            <Button className="shrink-0" disabled={!recordDonationId || submitted} onClick={recordDisposition}>
              {submitted ? "Recorded" : "Confirm disposition"}
            </Button>
          </div>
          {submitted && <p className="mt-2 text-xs text-green-600">Disposition recorded. Refresh the list below.</p>}
        </CardContent>
      </Card>

      {/* Dispositions list */}
      {withDisposition.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No dispositions recorded"
          description="Record a disposition above when a package reaches its final outcome."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withDisposition.map((d) => {
            const disp = d.disposition;
            return (
              <Link key={d.id} href={`/donations/${d.code}`} className="block">
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                    <div>
                      <span className="text-sm font-semibold text-medical-700 hover:text-medical-800">{d.code}</span>
                      <p className="text-xs text-slate-500">{d.packageInfo?.description ?? "No description"}</p>
                    </div>
                    <Badge variant="medical">{disp ? (DISPOSITION_LABELS[disp.type ?? ""] ?? disp.type) : d.disposition?.type}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm text-slate-600">
                      {disp?.note && <p>{disp.note}</p>}
                      <p className="text-xs text-slate-500">
                        {disp?.authorisedByUid && `Authorised by ${disp.authorisedByUid}`}
                        {disp?.authorisedAt && " · "}
                        {disp?.authorisedAt && new Date(disp.authorisedAt as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit" })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
