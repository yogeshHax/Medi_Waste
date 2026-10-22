"use client"
import { dataStore } from "@/lib/data-store";
import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, X, ChevronRight, Search, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDataStoreVersion } from "@/lib/use-data-store";

export default function ReviewPage() {
  useDataStoreVersion();
  const donations = dataStore.listDonations();
  const withOpenDiscrepancies = donations.filter((d) => d.discrepancies?.some((d) => d.status === "open"));
  const awaitingReview = donations.filter(
    (d) => d.status === "quarantined_for_review" || d.status === "awaiting_authorised_decision" || d.status === "pending_verification"
  );
  const resolvedDiscrepancies = donations
    .filter((d) => d.discrepancies)
    .flatMap((d) => (d.discrepancies ?? []).filter((d) => d.status !== "open").map((disc) => ({ donation: d, disc })));

  return (
    <>
      <PageHeading
        title="Review"
        description="Discrepancy queue and authorised review workspace."
      />

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{withOpenDiscrepancies.length}</p>
            <p className="text-sm text-slate-500">Open discrepancies</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{awaitingReview.length}</p>
            <p className="text-sm text-slate-500">Awaiting review</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{resolvedDiscrepancies.length}</p>
            <p className="text-sm text-slate-500">Resolved discrepancies</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Open discrepancy queue */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Discrepancy queue
          </h2>
          {withOpenDiscrepancies.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No open discrepancies"
              description="All reported discrepancies have been reviewed or waived."
            />
          ) : (
            <div className="space-y-3">
              {withOpenDiscrepancies.map((d) => (
                <DonationReviewCard key={d.id} donation={d} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resolved discrepancies */}
      <div className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Check className="h-5 w-5 text-green-600" />
          Resolved discrepancies
        </h2>
        {resolvedDiscrepancies.length === 0 ? (
          <p className="text-sm text-slate-500">No resolved discrepancies to show.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resolvedDiscrepancies.slice(0, 15).map(({ donation, disc }) => (
              <Link key={disc.id} href={`/donations/${donation.code}`} className="block">
                <Card className="h-full">
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">{donation.code}</span>
                      <Badge variant="success">Resolved</Badge>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{disc.title}</p>
                    {disc.resolution && <p className="text-xs text-slate-500">{disc.resolution}</p>}
                    {disc.resolvedAt && (
                      <p className="mt-auto text-xs text-slate-400">
                        {new Date(disc.resolvedAt as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function DonationReviewCard({ donation }: { donation: any }) {
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const openDiscrepancies = donation.discrepancies?.filter((d: any) => d.status === "open") ?? [];

  function handleDecision(choice: "approved" | "rejected") {
    if (!reason.trim()) {
      alert("Please enter a reason for the decision.");
      return;
    }
    const now = new Date();
    dataStore.updateDonation(donation.id, {
      status: choice === "approved" ? "approved_for_next_stage" : "rejected",
      review: { reviewerUid: "current-user", decision: choice, reason: reason.trim(), reviewedAt: now },
      // The decision closes the discrepancy queue entry; otherwise the record
      // stays "open" forever and keeps reappearing for review.
      discrepancies: (donation.discrepancies ?? []).map((d: any) =>
        d.status === "open"
          ? {
              ...d,
              status: choice === "approved" ? ("resolved" as const) : ("waived" as const),
              resolution: reason.trim(),
              resolvedByUid: "current-user",
              resolvedAt: now,
            }
          : d
      ),
      auditHistory: [{ event: "review_decision", actorUid: "current-user", detail: `Review decision: ${choice}`, at: now }],
    });
    setDecision(choice);
    setSubmitted(true);
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/donations/${donation.code}`} className="text-sm font-semibold text-medical-700 hover:text-medical-800">
                {donation.code}
              </Link>
              <Badge variant={dataStore.getStatusVariant(donation.status)}>
                {dataStore.getStatusLabel(donation.status)}
              </Badge>
            </div>
            {donation.packageInfo?.description && (
              <p className="mt-0.5 truncate text-sm text-slate-600">{donation.packageInfo.description}</p>
            )}
            {donation.packageInfo?.batchNumber && (
              <p className="mt-1 text-xs text-slate-500">Batch {donation.packageInfo.batchNumber}</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            {new Date(donation.updatedAt as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit" })}
          </div>
        </div>

        {/* Open discrepancies */}
        <div className="mt-3 space-y-2">
          {openDiscrepancies.map((d: any) => (
            <div key={d.id} className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm">
              <p className="font-medium text-red-700">{d.title}</p>
              <p className="mt-1 text-red-600">{d.detail}</p>
            </div>
          ))}
        </div>

        {/* Review decision form */}
        {submitted ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            <Check className="h-4 w-4 shrink-0" />
            Decision recorded.{" "}
            {decision === "approved" ? "Approved for next stage." : "Rejected."}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3 pt-3 border-t border-slate-200">
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1"
                onClick={() => handleDecision("approved")}
                disabled={decision !== null}
              >
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 gap-1"
                onClick={() => handleDecision("rejected")}
                disabled={decision !== null}
              >
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-medical-500 focus:outline-none focus:ring-1 focus:ring-medical-500"
              placeholder="Reason for decision (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={decision !== null}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
