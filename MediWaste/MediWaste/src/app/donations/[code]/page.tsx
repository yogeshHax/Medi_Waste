"use client"
import { dataStore } from "@/lib/data-store";
import type { Donation } from "@/types";
import { StatusBadge } from "@/components/status-badge";
import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  ArrowLeft,
  ClipboardList,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowLeftRight,
  Receipt,
  History,
  FileText,
  Clock,
  Check,
  X,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useParams } from "next/navigation";
import React from "react";
import { useState, useTransition } from "react";

export default function DonationDetailPage() {
  const params = useParams();
  const code = params.code as string;
  // Client-side store mutations must drive local state; calling router.refresh()
  // would replace this tree with the server's seed snapshot.
  const [donation, setDonation] = useState<Donation | null>(
    () => dataStore.getDonation(code) ?? null
  );

  if (!donation) notFound();

  const refreshDonation = () => setDonation(dataStore.getDonation(code) ?? null);

  return (
    <>
      <PageHeading
        title={donation.code}
        description={
          donation.packageInfo?.description
            ? `${donation.packageInfo.description} · ${donation.packageInfo?.form ?? ""} ${donation.packageInfo?.strength ?? ""}`.trim()
            : "Package detail"
        }
        actions={
          <Link href="/donations">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back to donations
            </Button>
          </Link>
        }
      />

      {/* Status + key facts */}
      <div className="flex flex-wrap items-start gap-6 mb-8">
        <StatusBadge status={donation.status} />
        <div className="flex flex-wrap gap-6 text-sm text-slate-600">
          {donation.packageInfo?.batchNumber && (
            <span>
              <span className="text-slate-400">Batch</span> {donation.packageInfo.batchNumber}
            </span>
          )}
          {donation.packageInfo?.expiryDate && (
            <span>
              <span className="text-slate-400">Expiry</span>{" "}
              {new Date(donation.packageInfo.expiryDate as any).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          )}
          {donation.packageInfo?.quantity && (
            <span>
              <span className="text-slate-400">Quantity</span> {donation.packageInfo.quantity} {donation.packageInfo.unit}
            </span>
          )}
          {donation.donorInfo?.name && (
            <span>
              <span className="text-slate-400">Donor</span> {donation.donorInfo.name}
            </span>
          )}
          {donation.intakeLocationId && (() => {
            const loc = dataStore.getLocation(donation.intakeLocationId);
            return loc ? (
              <span>
                <span className="text-slate-400">Intake at</span> {loc.name}
              </span>
            ) : null;
          })()}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main detail */}
        <div className="lg:col-span-2 space-y-6">
          {/* Actions */}
          <DonationActions
            donationId={donation.id}
            code={donation.code}
            currentStatus={donation.status}
            onUpdated={refreshDonation}
          />

          {/* Inspection */}
          <SectionCard
            icon={ClipboardList}
            title="Inspection"
            description={donation.inspection ? "Inspection has been completed." : "No inspection recorded yet."}
          >
            {donation.inspection ? (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
                  {donation.inspection.startedByUid && (
                    <span><span className="text-slate-400">Started by</span> {donation.inspection.startedByUid}</span>
                  )}
                  {donation.inspection.startedAt && (
                    <span><span className="text-slate-400">Started</span> {new Date(donation.inspection.startedAt as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                  )}
                  {donation.inspection.completedByUid && (
                    <span><span className="text-slate-400">Completed by</span> {donation.inspection.completedByUid}</span>
                  )}
                  {donation.inspection.completedAt && (
                    <span><span className="text-slate-400">Completed</span> {new Date(donation.inspection.completedAt as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                  )}
                </div>
                {donation.inspection.observations && donation.inspection.observations.length ? (
                  <ul className="list-disc pl-5 text-slate-600">
                    {donation.inspection.observations.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                ) : null}
                {donation.inspection.verificationOutcome && (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                    <span className="font-medium text-slate-900">Verification outcome:</span>{" "}
                    <span className="text-slate-600">{donation.inspection.verificationOutcome}</span>
                    {donation.inspection.verificationReason && (
                      <p className="mt-1 text-slate-500">{donation.inspection.verificationReason}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Waiting to be started by an inspector.</p>
            )}
          </SectionCard>

          {/* Verification checks */}
          <SectionCard
            icon={Search}
            title="Verification checks"
            description={donation.verificationChecks ? `${donation.verificationChecks.length} check${donation.verificationChecks.length === 1 ? "" : "s"} recorded.` : "No checks recorded."}
          >
            {donation.verificationChecks && donation.verificationChecks.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Check</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-[130px]">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donation.verificationChecks.map((c) => (
                    <TableRow key={c.checkId}>
                      <TableCell className="font-medium text-slate-900">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          c.result === "pass" ? "success" :
                          c.result === "fail" ? "destructive" :
                          c.result === "inconclusive" ? "warning" : "secondary"
                        }>
                          {c.result}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">{c.detail ?? "—"}</TableCell>
                      <TableCell className="text-slate-500">{c.source}</TableCell>
                      <TableCell className="text-slate-500">
                        {new Date(c.at as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-slate-500">No verification checks have been recorded yet.</p>
            )}
          </SectionCard>

          {/* Discrepancies */}
          <SectionCard
            icon={AlertTriangle}
            title="Discrepancies"
            description={donation.discrepancies ? `${donation.discrepancies.length} discrepanc${donation.discrepancies.length === 1 ? "y" : "ies"} recorded.` : "No discrepancies reported."}
          >
            {donation.discrepancies && donation.discrepancies.length ? (
              <div className="space-y-3">
                {donation.discrepancies.map((d) => (
                  <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{d.title}</p>
                          <Badge variant={d.status === "open" ? "destructive" : d.status === "resolved" ? "success" : "secondary"}>
                            {d.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{d.detail}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {d.reportedByUid && <span>Reported by {d.reportedByUid}</span>}
                      {d.reportedAt && <span>{new Date(d.reportedAt as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>}
                      {d.resolution && <span>Resolution: {d.resolution}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No discrepancies have been reported for this package.</p>
            )}
          </SectionCard>

          {/* Audit history */}
          <SectionCard icon={History} title="Audit history" description="Append-only record of events and actors.">
            {donation.auditHistory && donation.auditHistory.length ? (
              <div className="space-y-2">
                {donation.auditHistory.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-medical-500" />
                    <div>
                      <p className="font-medium text-slate-900">{e.event.replace(/_/g, " ")}</p>
                      {e.detail && <p className="text-slate-600">{e.detail}</p>}
                      <p className="mt-0.5 text-xs text-slate-500">
                        {e.actorUid && `By ${e.actorUid}`} · {new Date(e.at as any).toLocaleString("en-GB", { day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No audit events recorded yet.</p>
            )}
          </SectionCard>
        </div>

        {/* Sidebar: review, handover, disposition */}
        <div className="space-y-6">
          {/* Review */}
          <SectionCard icon={ShieldCheck} title="Review" description={donation.review ? "A review decision has been recorded." : "No review decision yet."}>
            {donation.review ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={donation.review.decision === "approved" ? "success" : donation.review.decision === "rejected" ? "destructive" : "warning"}>
                    {donation.review.decision}
                  </Badge>
                  <span className="text-slate-500">by {donation.review.reviewerUid}</span>
                </div>
                {donation.review.reason && <p className="text-slate-600">{donation.review.reason}</p>}
                {donation.review.reviewedAt && (
                  <p className="text-xs text-slate-500">{new Date(donation.review.reviewedAt as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Awaiting authorised review.</p>
            )}
          </SectionCard>

          {/* Handover chain */}
          <SectionCard icon={ArrowLeftRight} title="Chain of custody" description={donation.handoverChain ? `${donation.handoverChain.length} handover${donation.handoverChain.length === 1 ? "" : "s"} recorded.` : "No handovers recorded."}>
            {donation.handoverChain && donation.handoverChain.length ? (
              <div className="space-y-3">
                {donation.handoverChain.map((h) => {
                  return (
                    <div key={h.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      <ArrowLeftRight className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-slate-900">
                          {h.fromUid} → {h.toUid}
                        </p>
                        {h.note && <p className="text-slate-600">{h.note}</p>}
                        <p className="mt-0.5 text-xs text-slate-500">
                          {new Date(h.at as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No handovers have been recorded.</p>
            )}
          </SectionCard>

          {/* Disposition */}
          <SectionCard icon={Receipt} title="Disposition" description={donation.disposition ? "A final disposition has been recorded." : "No disposition recorded."}>
            {donation.disposition ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="medical">{donation.disposition.type?.replace(/_/g, " ")}</Badge>
                  {donation.disposition.note && <span className="text-slate-600">{donation.disposition.note}</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {donation.disposition.authorisedByUid && <span>Authorised by {donation.disposition.authorisedByUid}</span>}
                  {donation.disposition.authorisedAt && " · "}
                  {donation.disposition.authorisedAt && new Date(donation.disposition.authorisedAt as any).toLocaleString("en-GB", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No disposition recorded.</p>
            )}
          </SectionCard>

          {/* Reference lookup hint */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="flex items-start gap-3 text-sm text-slate-600">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="font-medium text-slate-900">Reference data</p>
                <p className="mt-1">
                  Seeded reference products are for demonstration only and do not constitute an official pharmaceutical database.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: any;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-medical-50 text-medical-700">
              {React.createElement(icon, { className: "h-4 w-4" })}
            </div>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// -------------------------------------------------------------------
// Actions component (client)
// -------------------------------------------------------------------
function DonationActions({
  donationId,
  code,
  currentStatus,
  onUpdated,
}: {
  donationId: string;
  code: string;
  currentStatus: string;
  onUpdated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function flash(message: string, type: "success" | "error") {
    setActionFeedback({ message, type });
    window.setTimeout(() => setActionFeedback(null), 3500);
  }

  async function doAction(update: (current: any) => any) {
    startTransition(async () => {
      const current = dataStore.getDonation(donationId);
      if (!current) {
        flash("Could not apply action.", "error");
        return;
      }
      const updated = dataStore.updateDonation(donationId, update(current));
      if (updated) {
        flash("Action recorded.", "success");
        onUpdated();
      } else {
        flash("Could not apply action.", "error");
      }
    });
  }

  return (
    <Card className="!p-4">
      <CardHeader className="!p-0 pb-3">
        <CardTitle className="text-base">Available actions</CardTitle>
      </CardHeader>
      <CardContent className="!p-0">
        <div className="flex flex-wrap gap-2">
          {(currentStatus === "registered" || currentStatus === "awaiting_inspection") && (
            <Button
              size="sm"
              onClick={() => doAction((patch) => ({
                ...patch,
                status: "inspection_in_progress" as const,
                inspection: { startedByUid: "current-user", startedAt: new Date(), completedByUid: undefined, completedAt: undefined, observations: [], evidenceRefs: [], verificationOutcome: undefined, verificationReason: undefined } as any,
                auditHistory: [{ event: "inspection_started", actorUid: "current-user", detail: "Inspection started.", at: new Date() }],
              }))}
              disabled={pending}
            >
              <Check className="h-3.5 w-3.5" /> Start inspection
            </Button>
          )}
          {(currentStatus === "inspection_in_progress" || currentStatus === "pending_verification") && (
            <Button
              size="sm"
              onClick={() => {
                const obs = window.prompt("Enter inspection observations (comma-separated):") || "";
                const outcome = window.prompt("Verification outcome (e.g. pass, fail, review_required):") || "review_required";
                const reason = window.prompt("Reason (optional):") || "";
                if (obs !== null && outcome) {
                  doAction((patch) => ({
                    ...patch,
                    status: outcome === "fail" ? "discrepancy_detected" as const : "pending_verification" as const,
                    inspection: {
                      startedByUid: "current-user",
                      startedAt: new Date(),
                      completedByUid: "current-user",
                      completedAt: new Date(),
                      observations: obs.split(",").map((s) => s.trim()).filter(Boolean),
                      evidenceRefs: [],
                      verificationOutcome: outcome,
                      verificationReason: reason,
                    } as any,
                    auditHistory: [{ event: "verification_completed", actorUid: "current-user", detail: `Verification outcome: ${outcome}`, at: new Date() }],
                  }));
                }
              }}
              disabled={pending}
            >
              <FileText className="h-3.5 w-3.5" /> Complete inspection
            </Button>
          )}
          {currentStatus === "pending_verification" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const title = window.prompt("Discrepancy title:") || "Manual review required";
                const detail = window.prompt("Discrepancy detail:") || "Additional review needed.";
                if (title) {
                  const d = {
                    id: `disc-${Date.now()}`,
                    title,
                    detail,
                    status: "open" as const,
                    reportedByUid: "current-user",
                    reportedAt: new Date(),
                  };
                  doAction((patch) => ({
                    ...patch,
                    status: "quarantined_for_review" as const,
                    discrepancies: [...(patch?.discrepancies ?? []), d],
                    auditHistory: [{ event: "discrepancy_reported", actorUid: "current-user", detail: `Discrepancy: ${title}`, at: new Date() }],
                  }));
                }
              }}
              disabled={pending}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Report discrepancy
            </Button>
          )}
          {(currentStatus === "quarantined_for_review" || currentStatus === "discrepancy_detected" || currentStatus === "pending_verification") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const decision = window.prompt("Review decision (approved/rejected):") || "pending";
                const reason = window.prompt("Reason:") || "";
                if (["approved", "rejected"].includes(decision)) {
                  doAction((patch) => ({
                    ...patch,
                    status: decision === "approved" ? "approved_for_next_stage" as const : "rejected" as const,
                    review: { reviewerUid: "current-user", decision: decision as any, reason, reviewedAt: new Date() } as any,
                    auditHistory: [{ event: "review_decision", actorUid: "current-user", detail: `Review decision: ${decision}`, at: new Date() }],
                  }));
                }
              }}
              disabled={pending}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Record review decision
            </Button>
          )}
          {currentStatus === "approved_for_next_stage" && (
            <Button
              size="sm"
              onClick={() => {
                const toUid = window.prompt("Handover to (identifier):") || "current-user";
                const note = window.prompt("Note (optional):") || "";
                if (toUid) {
                  const h = {
                    id: `ho-${Date.now()}`,
                    fromUid: "current-user",
                    toUid,
                    note: note || undefined,
                    at: new Date(),
                  };
                  doAction((patch) => ({
                    ...patch,
                    handoverChain: [...(patch?.handoverChain ?? []), h],
                    auditHistory: [{ event: "handover_recorded", actorUid: "current-user", detail: `Handover to ${toUid}`, at: new Date() }],
                  }));
                }
              }}
              disabled={pending}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" /> Record handover
            </Button>
          )}
          {(currentStatus === "approved_for_next_stage" || currentStatus === "rejected" || currentStatus === "quarantined_for_review") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const type = window.prompt("Disposition type (reuse_eligible, destroy, return_to_supplier, held, other):") || "held";
                const note = window.prompt("Note (optional):") || "";
                if (type) {
                  doAction((patch) => ({
                    ...patch,
                    status: "disposition_recorded" as const,
                    disposition: { type: type as any, authorisedByUid: "current-user", authorisedAt: new Date(), note: note || undefined } as any,
                    auditHistory: [{ event: "disposition_recorded", actorUid: "current-user", detail: `Disposition: ${type}`, at: new Date() }],
                  }));
                }
              }}
              disabled={pending}
            >
              <Receipt className="h-3.5 w-3.5" /> Record disposition
            </Button>
          )}
        </div>
      </CardContent>
      {actionFeedback && (
        <div className={`mt-3 rounded-lg p-3 text-sm ${actionFeedback.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {actionFeedback.message}
        </div>
      )}
    </Card>
  );
}
