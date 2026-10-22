/**
 * Backend business logic for MedWaste VerifyPoint.
 *
 * In production, these functions are enforced inside Firebase Cloud Functions
 * (HTTPS callable or HTTP functions) so that authorisation and validation
 * cannot be bypassed from the client.
 *
 * For the local emulator demo, the same logic is mirrored in the client-side
 * data store so the UI can be demonstrated without real credentials.
 */

import {
  Donation,
  DonationStatus,
  Station,
  DonationStatusSchema,
} from "@/types";
import { dataStore } from "@/lib/data-store";

// ---------------------------------------------------------------------------
// Roles allowed to perform each action (production: enforced in Cloud Functions)
// ---------------------------------------------------------------------------
const ROLE_ALLOWED = {
  startInspection: ["intake", "reviewer", "admin"] as string[],
  completeInspection: ["intake", "reviewer", "admin"] as string[],
  reportDiscrepancy: ["intake", "reviewer", "admin"] as string[],
  resolveDiscrepancy: ["reviewer", "admin"] as string[],
  reviewDecision: ["reviewer", "admin"] as string[],
  approveForNextStage: ["reviewer", "admin"] as string[],
  recordHandover: ["intake", "reviewer", "admin"] as string[],
  recordDisposition: ["admin"] as string[],
  openGate: ["admin"] as string[],
  closeGate: ["admin"] as string[],
} as const;

export function canUserPerform(role: string | undefined | null, action: keyof typeof ROLE_ALLOWED): boolean {
  if (!role) return false;
  return (ROLE_ALLOWED[action] as string[]).includes(role);
}

// ---------------------------------------------------------------------------
// Donation intake
// ---------------------------------------------------------------------------
export function createDonation(input: {
  code: string;
  packageInfo?: Donation["packageInfo"];
  donorInfo?: Donation["donorInfo"];
  intakeLocationId?: string;
  intakeStaffUid: string;
}): Donation {
  if (!input.code.trim()) throw new Error("Package code is required.");
  if (!input.intakeStaffUid.trim()) throw new Error("Intake staff identifier is required.");

  // Prevent accidental duplicate submissions of the same code in the demo store.
  const existing = dataStore.getDonation(input.code);
  if (existing && existing.status !== "disposition_recorded") {
    throw new Error(`A donation with code ${input.code} already exists.`);
  }

  return dataStore.createDonation(input as any);
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------
export function startInspection(donationId: string, startedByUid: string, role: string | null): Donation {
  if (!canUserPerform(role, "startInspection")) {
    throw new Error("You are not authorised to start an inspection.");
  }
  const donation = dataStore.getDonation(donationId);
  if (!donation) throw new Error("Donation not found.");
  if (donation.status === "inspection_in_progress") {
    throw new Error("An inspection is already in progress for this donation.");
  }
  if (donation.status === "disposition_recorded") {
    throw new Error("This donation has already been disposed of and cannot be inspected.");
  }

  return dataStore.updateDonation(donationId, {
    status: "inspection_in_progress",
    inspection: {
      startedByUid,
      startedAt: new Date(),
      completedByUid: undefined,
      completedAt: undefined,
      observations: [],
      evidenceRefs: [],
      verificationOutcome: undefined,
      verificationReason: undefined,
    },
    auditHistory: [{ event: "inspection_started", actorUid: startedByUid, detail: "Inspection started.", at: new Date() }],
  })!;
}

export function completeInspection(input: {
  donationId: string;
  completedByUid: string;
  observations: string[];
  evidenceRefs?: string[];
  verificationOutcome: string;
  verificationReason: string;
  role: string | null;
}): Donation {
  if (!canUserPerform(input.role, "completeInspection")) {
    throw new Error("You are not authorised to complete an inspection.");
  }
  const donation = dataStore.getDonation(input.donationId);
  if (!donation) throw new Error("Donation not found.");
  if (!donation.inspection || donation.inspection.startedByUid === undefined) {
    throw new Error("No inspection has been started for this donation.");
  }

  const outcome = input.verificationOutcome;
  let nextStatus: DonationStatus = "pending_verification";
  if (outcome.toLowerCase().includes("fail") || outcome.toLowerCase().includes("discrepancy")) {
    nextStatus = "discrepancy_detected";
  } else if (outcome.toLowerCase().includes("review")) {
    nextStatus = "pending_verification";
  } else if (outcome.toLowerCase().includes("pass")) {
    nextStatus = "approved_for_next_stage";
  }

  return dataStore.updateDonation(input.donationId, {
    status: nextStatus,
    inspection: {
      startedByUid: donation.inspection.startedByUid,
      startedAt: donation.inspection.startedAt,
      completedByUid: input.completedByUid,
      completedAt: new Date(),
      observations: input.observations,
      evidenceRefs: input.evidenceRefs ?? [],
      verificationOutcome: input.verificationOutcome,
      verificationReason: input.verificationReason,
    },
    auditHistory: [
      {
        event: "verification_completed",
        actorUid: input.completedByUid,
        detail: `Verification outcome: ${input.verificationOutcome}`,
        at: new Date(),
      },
    ],
  })!;
}

// ---------------------------------------------------------------------------
// Verification checks (recorded as part of inspection; enforced backend in prod)
// ---------------------------------------------------------------------------
export function recordVerificationCheck(input: {
  donationId: string;
  checkId: string;
  name: string;
  result: "pass" | "fail" | "inconclusive" | "not_run";
  detail?: string;
  source: string;
  at: Date;
}): Donation {
  const donation = dataStore.getDonation(input.donationId);
  if (!donation) throw new Error("Donation not found.");
  const checks = donation.verificationChecks ?? [];
  const updatedChecks = checks.map((c) => (c.checkId === input.checkId ? { ...c, ...input } : c));
  if (!updatedChecks.find((c) => c.checkId === input.checkId)) {
    updatedChecks.push(input as any);
  }
  return dataStore.updateDonation(input.donationId, { verificationChecks: updatedChecks })!;
}

// ---------------------------------------------------------------------------
// Discrepancies
// ---------------------------------------------------------------------------
export function reportDiscrepancy(input: {
  donationId: string;
  title: string;
  detail: string;
  reportedByUid: string;
  role: string | null;
}): Donation {
  if (!canUserPerform(input.role, "reportDiscrepancy")) {
    throw new Error("You are not authorised to report discrepancies.");
  }
  if (!input.title.trim() || !input.detail.trim()) {
    throw new Error("Discrepancy title and detail are required.");
  }
  const donation = dataStore.getDonation(input.donationId);
  if (!donation) throw new Error("Donation not found.");

  const discrepancy = {
    id: `disc-${Date.now()}`,
    title: input.title.trim(),
    detail: input.detail.trim(),
    status: "open" as const,
    reportedByUid: input.reportedByUid,
    reportedAt: new Date(),
  };

  return dataStore.updateDonation(input.donationId, {
    discrepancies: [...(donation.discrepancies ?? []), discrepancy],
    status: "quarantined_for_review",
    auditHistory: [
      {
        event: "discrepancy_reported",
        actorUid: input.reportedByUid,
        detail: `Discrepancy: ${input.title}`,
        at: new Date(),
      },
    ],
  })!;
}

export function resolveDiscrepancy(input: {
  donationId: string;
  discrepancyId: string;
  resolution: string;
  resolvedByUid: string;
  role: string | null;
}): Donation {
  if (!canUserPerform(input.role, "resolveDiscrepancy")) {
    throw new Error("You are not authorised to resolve discrepancies.");
  }
  const donation = dataStore.getDonation(input.donationId);
  if (!donation) throw new Error("Donation not found.");

  const discrepancies = (donation.discrepancies ?? []).map((d) =>
    d.id === input.discrepancyId
      ? { ...d, status: "resolved" as const, resolution: input.resolution.trim(), resolvedByUid: input.resolvedByUid, resolvedAt: new Date() }
      : d
  );

  return dataStore.updateDonation(input.donationId, { discrepancies })!;
}

// ---------------------------------------------------------------------------
// Review decisions
// ---------------------------------------------------------------------------
export function reviewDecision(input: {
  donationId: string;
  decision: "approved" | "rejected";
  reason: string;
  reviewedByUid: string;
  role: string | null;
}): Donation {
  if (!canUserPerform(input.role, "reviewDecision")) {
    throw new Error("You are not authorised to make review decisions.");
  }
  if (!input.reason.trim()) throw new Error("A reason is required for the review decision.");
  const donation = dataStore.getDonation(input.donationId);
  if (!donation) throw new Error("Donation not found.");

  const nextStatus = input.decision === "approved" ? "approved_for_next_stage" : "rejected";

  return dataStore.updateDonation(input.donationId, {
    status: nextStatus,
    review: {
      reviewerUid: input.reviewedByUid,
      decision: input.decision,
      reason: input.reason.trim(),
      reviewedAt: new Date(),
    },
    auditHistory: [
      {
        event: "review_decision",
        actorUid: input.reviewedByUid,
        detail: `Review decision: ${input.decision}`,
        at: new Date(),
      },
    ],
  })!;
}

// ---------------------------------------------------------------------------
// Chain of custody
// ---------------------------------------------------------------------------
export function recordHandover(input: {
  donationId: string;
  fromUid: string;
  toUid: string;
  note?: string;
  role: string | null;
}): Donation {
  if (!canUserPerform(input.role, "recordHandover")) {
    throw new Error("You are not authorised to record handovers.");
  }
  const donation = dataStore.getDonation(input.donationId);
  if (!donation) throw new Error("Donation not found.");

  const last = donation.handoverChain && donation.handoverChain.length ? donation.handoverChain[donation.handoverChain.length - 1] : null;
  const handover = {
    id: `ho-${Date.now()}`,
    fromUid: last ? last.toUid : input.fromUid,
    toUid: input.toUid,
    note: input.note?.trim() || "Handover recorded",
    at: new Date(),
  };

  return dataStore.updateDonation(input.donationId, {
    handoverChain: [...(donation.handoverChain ?? []), handover],
    auditHistory: [
      {
        event: "handover_recorded",
        actorUid: input.fromUid,
        detail: `Handover to ${input.toUid}`,
        at: new Date(),
      },
    ],
  })!;
}

// ---------------------------------------------------------------------------
// Dispositions
// ---------------------------------------------------------------------------
export function recordDisposition(input: {
  donationId: string;
  type: "reuse_eligible" | "destroy" | "return_to_supplier" | "held" | "other";
  note?: string;
  authorisedByUid: string;
  role: string | null;
}): Donation {
  if (!canUserPerform(input.role, "recordDisposition")) {
    throw new Error("Only administrators may record dispositions.");
  }
  const donation = dataStore.getDonation(input.donationId);
  if (!donation) throw new Error("Donation not found.");

  return dataStore.updateDonation(input.donationId, {
    status: "disposition_recorded",
    disposition: {
      type: input.type,
      authorisedByUid: input.authorisedByUid,
      authorisedAt: new Date(),
      note: input.note?.trim() || undefined,
    },
    auditHistory: [
      {
        event: "disposition_recorded",
        actorUid: input.authorisedByUid,
        detail: `Disposition: ${input.type}`,
        at: new Date(),
      },
    ],
  })!;
}

// ---------------------------------------------------------------------------
// Station management
// ---------------------------------------------------------------------------
export function openGate(stationId: string, role: string | null): Station {
  if (!canUserPerform(role, "openGate")) throw new Error("Only administrators may open the gate.");
  const station = dataStore.getStation(stationId);
  if (!station) throw new Error("Station not found.");
  return dataStore.updateStation(stationId, { gateState: "open" })!;
}

export function closeGate(stationId: string, role: string | null): Station {
  if (!canUserPerform(role, "closeGate")) throw new Error("Only administrators may close the gate.");
  const station = dataStore.getStation(stationId);
  if (!station) throw new Error("Station not found.");
  return dataStore.updateStation(stationId, { gateState: "closed" })!;
}

export function recordStationEvent(event: { stationId: string; type: string; payload: any }) {
  dataStore.pushStationEvent({
    stationId: event.stationId,
    type: event.type as any,
    payload: event.payload,
    receivedAt: new Date(),
  });
  // Keep station online on heartbeat
  if (event.type === "heartbeat") {
    dataStore.updateStation(event.stationId, { lastHeartbeat: new Date(), online: true });
  }
}

// ---------------------------------------------------------------------------
// Reports (derived from current local store; in production: Firestore aggregations)
// ---------------------------------------------------------------------------
export function getStatusCounts() {
  const donations = dataStore.listDonations();
  return donations.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});
}

export function getOperationalSummary() {
  const donations = dataStore.listDonations();
  const totalItems = donations.reduce((acc, d) => acc + (d.packageInfo?.quantity ?? 0), 0);
  const openDiscrepancies = donations.reduce(
    (acc, d) => acc + (d.discrepancies?.filter((d) => d.status === "open").length ?? 0),
    0
  );
  const approved = donations.filter((d) => d.review?.decision === "approved").length;
  const rejected = donations.filter((d) => d.review?.decision === "rejected").length;
  const dispositions = donations.filter((d) => d.disposition).length;

  return {
    totalDonations: donations.length,
    totalItems,
    approved,
    rejected,
    openDiscrepancies,
    dispositions,
    stationsOnline: dataStore.listStations().filter((s) => s.online).length,
    stationsTotal: dataStore.listStations().length,
  };
}
