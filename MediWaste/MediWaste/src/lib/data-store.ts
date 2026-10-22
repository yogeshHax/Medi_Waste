/**
 * In-memory data store for local development and emulator demos.
 *
 * In production this is backed by Cloud Firestore + Cloud Functions.
 * This store intentionally seeds only clearly-labelled fictional data so
 * the UI, workflow, and hardware simulator can be demonstrated locally.
 */
import {
  Donation,
  DonationStatus,
  Station,
  Location,
  ReferenceProduct,
  StationEvent,
  StationCommand,
} from "@/types";
import { syncDocument } from "@/lib/firestore-sync";

// ---------------------------------------------------------------------------
// Seed data — fictional, labelled for demonstration
// ---------------------------------------------------------------------------
// A fixed clock keeps server-rendered HTML byte-identical to the client render.
// Relative offsets in the demo seed must never depend on wall-clock time.
const SEED_NOW = new Date("2026-10-21T09:00:00.000Z").getTime();

const FAKE_LOCATIONS: Location[] = [
  { id: "loc-1", name: "MedWaste Central Intake", address: "12 Station Road, Leeds LS1 2AB", createdAt: new Date(SEED_NOW) },
  { id: "loc-2", name: "Community Pharmacy Hub", address: "45 Market Street, Bradford BD1 1NN", createdAt: new Date(SEED_NOW) },
];

const FAKE_STATIONS: Station[] = [
  {
    id: "station-1",
    name: "Verification Station A",
    locationId: "loc-1",
    serialNumber: "MW-VS-A-001",
    // No live heartbeat has been received in a fresh session; the station
    // console must not claim it is online before the simulator/bridge connects.
    online: false,
    lastHeartbeat: new Date(SEED_NOW),
    gateState: "closed",
    createdAt: new Date(SEED_NOW),
  },
  {
    id: "station-2",
    name: "Verification Station B",
    locationId: "loc-2",
    serialNumber: "MW-VS-B-002",
    online: false,
    lastHeartbeat: new Date(SEED_NOW - 1000 * 60 * 15),
    gateState: "closed",
    createdAt: new Date(SEED_NOW),
  },
];

const FAKE_REFERENCE_PRODUCTS: ReferenceProduct[] = [
  { id: "ref-1", name: "Paracetamol 500mg tablets", manufacturer: "Fictional Pharma Co", form: "Tablet", strength: "500mg", notes: "Demo reference only — not an official pharmaceutical database.", isFictional: true },
  { id: "ref-2", name: "Amoxicillin 250mg capsules", manufacturer: "Fictional Pharma Co", form: "Capsule", strength: "250mg", notes: "Demo reference only.", isFictional: true },
  { id: "ref-3", name: "Lisinopril 10mg tablets", manufacturer: "Fictional Pharma Co", form: "Tablet", strength: "10mg", notes: "Demo reference only.", isFictional: true },
  { id: "ref-4", name: "Salbutamol 100mcg inhaler", manufacturer: "Fictional Pharma Co", form: "Inhaler", strength: "100mcg", notes: "Demo reference only.", isFictional: true },
];

const FAKE_DONATIONS: Donation[] = [
  {
    id: "don-1",
    code: "MW-AB12CD34",
    status: "pending_verification",
    packageInfo: { description: "Paracetamol 500mg tablets", form: "Tablet", strength: "500mg", manufacturer: "Fictional Pharma Co", batchNumber: "PMC2024-001", expiryDate: new Date("2027-03-01"), quantity: 50, unit: "tablets" },
    donorInfo: { name: "Community Donation Box", contact: "admin@example.org" },
    intakeLocationId: "loc-1",
    intakeStaffUid: "user-intake-1",
    intakeAt: new Date(SEED_NOW - 1000 * 60 * 60 * 24),
    inspection: {
      startedByUid: "user-inspect-1",
      startedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 24 + 1000 * 60 * 10),
      completedByUid: "user-inspect-1",
      completedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 24 + 1000 * 60 * 40),
      observations: ["Packaging intact", "No visible damage", "Batch number matches label"],
      evidenceRefs: [],
      verificationOutcome: "review_required",
      verificationReason: "Batch number not found in reference data; manual review recommended.",
    },
    verificationChecks: [
      { checkId: "vc-1", name: "Expiry check", result: "pass", detail: "Expires 2027-03-01", source: "inspector_entry", at: new Date(SEED_NOW - 1000 * 60 * 60 * 24 + 1000 * 60 * 20) },
      { checkId: "vc-2", name: "Reference data match", result: "inconclusive", detail: "Batch number not found in seeded reference data.", source: "reference_lookup", at: new Date(SEED_NOW - 1000 * 60 * 60 * 24 + 1000 * 60 * 25) },
      { checkId: "vc-3", name: "Visual inspection", result: "pass", detail: "Packaging intact", source: "inspector_entry", at: new Date(SEED_NOW - 1000 * 60 * 60 * 24 + 1000 * 60 * 30) },
    ],
    discrepancies: [
      {
        id: "disc-1",
        title: "Batch number not in reference data",
        detail: "Batch PMC2024-001 was not matched against the seeded reference product list.",
        status: "open",
        reportedByUid: "user-inspect-1",
        reportedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 24 + 1000 * 60 * 25),
      },
    ],
    review: {
      reviewerUid: "user-review-1",
      decision: "approved",
      reason: "Visual inspection passed, expiry acceptable, batch discrepancy noted for tracking. Fictional demo data.",
      reviewedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 23),
    },
    handoverChain: [
      { id: "ho-1", fromUid: "user-intake-1", toUid: "user-inspect-1", fromRole: "intake", toRole: "viewer", note: "Passed to inspection", at: new Date(SEED_NOW - 1000 * 60 * 60 * 24 + 1000 * 60 * 5) },
    ],
    disposition: { type: "reuse_eligible", authorisedByUid: "user-review-1", authorisedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 22), note: "Demo disposition." },
    auditHistory: [
      { event: "donation_registered", actorUid: "user-intake-1", detail: "Package MW-AB12CD34 registered at Central Intake.", at: new Date(SEED_NOW - 1000 * 60 * 60 * 24) },
      { event: "inspection_started", actorUid: "user-inspect-1", detail: "Inspection started.", at: new Date(SEED_NOW - 1000 * 60 * 60 * 24 + 1000 * 60 * 10) },
      { event: "verification_completed", actorUid: "user-inspect-1", detail: "Verification outcome: review_required.", at: new Date(SEED_NOW - 1000 * 60 * 60 * 24 + 1000 * 60 * 40) },
      { event: "review_decision", actorUid: "user-review-1", detail: "Review decision: approved.", at: new Date(SEED_NOW - 1000 * 60 * 60 * 23) },
      { event: "disposition_recorded", actorUid: "user-review-1", detail: "Disposition: reuse_eligible.", at: new Date(SEED_NOW - 1000 * 60 * 60 * 22) },
    ],
    updatedAt: new Date(SEED_NOW),
    createdAt: new Date(SEED_NOW - 1000 * 60 * 60 * 24),
  },
  {
    id: "don-2",
    code: "MW-EF56GH78",
    status: "awaiting_inspection",
    packageInfo: { description: "Amoxicillin 250mg capsules", form: "Capsule", strength: "250mg", manufacturer: "Fictional Pharma Co", batchNumber: "AMP2024-042", expiryDate: new Date("2026-06-30"), quantity: 28, unit: "capsules" },
    donorInfo: { name: "Anonymous Donor", contact: "" },
    intakeLocationId: "loc-1",
    intakeStaffUid: "user-intake-1",
    intakeAt: new Date(SEED_NOW - 1000 * 60 * 60 * 3),
    inspection: undefined,
    verificationChecks: undefined,
    discrepancies: undefined,
    review: undefined,
    handoverChain: undefined,
    disposition: undefined,
    auditHistory: [
      { event: "donation_registered", actorUid: "user-intake-1", detail: "Package MW-EF56GH78 registered.", at: new Date(SEED_NOW - 1000 * 60 * 60 * 3) },
    ],
    updatedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 3),
    createdAt: new Date(SEED_NOW - 1000 * 60 * 60 * 3),
  },
  {
    id: "don-3",
    code: "MW-IJ90KL12",
    status: "discrepancy_detected",
    packageInfo: { description: "Lisinopril 10mg tablets", form: "Tablet", strength: "10mg", manufacturer: "Fictional Pharma Co", batchNumber: "LSN2023-888", expiryDate: new Date("2025-01-10"), quantity: 100, unit: "tablets" },
    donorInfo: { name: "Pharmacy Returns", contact: "returns@example.org", address: "45 Market Street, Bradford" },
    intakeLocationId: "loc-2",
    intakeStaffUid: "user-intake-2",
    intakeAt: new Date(SEED_NOW - 1000 * 60 * 60 * 48),
    inspection: {
      startedByUid: "user-inspect-2",
      startedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 48 + 1000 * 60 * 20),
      completedByUid: "user-inspect-2",
      completedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 48 + 1000 * 60 * 50),
      observations: ["Past expiry date", "Packaging slightly crushed"],
      evidenceRefs: [],
      verificationOutcome: "discrepancy_detected",
      verificationReason: "Expired and packaging damaged.",
    },
    verificationChecks: [
      { checkId: "vc-4", name: "Expiry check", result: "fail", detail: "Expired 2025-01-10", source: "inspector_entry", at: new Date(SEED_NOW - 1000 * 60 * 60 * 48 + 1000 * 60 * 25) },
      { checkId: "vc-5", name: "Visual inspection", result: "fail", detail: "Packaging slightly crushed", source: "inspector_entry", at: new Date(SEED_NOW - 1000 * 60 * 60 * 48 + 1000 * 60 * 30) },
    ],
    discrepancies: [
      {
        id: "disc-2",
        title: "Product expired",
        detail: "Expiry date 2025-01-10 has passed.",
        status: "open",
        reportedByUid: "user-inspect-2",
        reportedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 48 + 1000 * 60 * 25),
      },
      {
        id: "disc-3",
        title: "Packaging damaged",
        detail: "Box is slightly crushed but seal appears intact.",
        status: "open",
        reportedByUid: "user-inspect-2",
        reportedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 48 + 1000 * 60 * 30),
      },
    ],
    review: undefined,
    handoverChain: [
      { id: "ho-2", fromUid: "user-intake-2", toUid: "user-inspect-2", fromRole: "intake", toRole: "viewer", note: "Passed to inspection", at: new Date(SEED_NOW - 1000 * 60 * 60 * 48 + 1000 * 60 * 15) },
    ],
    disposition: undefined,
    auditHistory: [
      { event: "donation_registered", actorUid: "user-intake-2", detail: "Package MW-IJ90KL12 registered at Community Pharmacy Hub.", at: new Date(SEED_NOW - 1000 * 60 * 60 * 48) },
      { event: "inspection_started", actorUid: "user-inspect-2", detail: "Inspection started.", at: new Date(SEED_NOW - 1000 * 60 * 60 * 48 + 1000 * 60 * 20) },
      { event: "verification_completed", actorUid: "user-inspect-2", detail: "Verification outcome: discrepancy_detected.", at: new Date(SEED_NOW - 1000 * 60 * 60 * 48 + 1000 * 60 * 50) },
    ],
    updatedAt: new Date(SEED_NOW - 1000 * 60 * 60 * 48 + 1000 * 60 * 50),
    createdAt: new Date(SEED_NOW - 1000 * 60 * 60 * 48),
  },
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
type StoreListener = () => void;

class DataStore {
  private donations: Donation[] = [...FAKE_DONATIONS];
  private stations: Station[] = [...FAKE_STATIONS];
  private locations: Location[] = [...FAKE_LOCATIONS];
  private referenceProducts: ReferenceProduct[] = [...FAKE_REFERENCE_PRODUCTS];
  private stationEvents: StationEvent[] = [];
  private stationCommands: StationCommand[] = [];
  private nextDonationId = 100;
  private nextDonationCode = 1000;
  // Client components subscribe so lists, counters and status badges refresh
  // immediately after a local mutation instead of showing a stale snapshot.
  private listeners = new Set<StoreListener>();
  private version = 0;

  subscribe = (fn: StoreListener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  private notify() {
    this.version += 1;
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // A broken subscriber must never block the store.
      }
    });
  }

  listDonations(filters?: { status?: string; search?: string }): Donation[] {
    let list = [...this.donations];
    if (filters?.status) list = list.filter((d) => d.status === filters.status);
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.code.toLowerCase().includes(q) ||
          d.packageInfo?.description?.toLowerCase().includes(q) ||
          d.donorInfo?.name?.toLowerCase().includes(q) ||
          d.packageInfo?.batchNumber?.toLowerCase().includes(q)
      );
    }
    return list.sort(
      (a, b) => new Date(b.updatedAt as Date).getTime() - new Date(a.updatedAt as Date).getTime()
    );
  }

  getDonation(id: string): Donation | undefined {
    return this.donations.find((d) => d.id === id || d.code === id);
  }

  createDonation(data: Omit<Donation, "id" | "status" | "auditHistory" | "createdAt" | "updatedAt">): Donation {
    const id = `don-${++this.nextDonationId}`;
    // Honour the code the intake operator supplied; fall back to a generated one.
    const code =
      data.code?.trim() || `MW-${String(this.nextDonationCode++).padStart(8, "0")}`;
    if (this.getDonation(code)) {
      throw new Error(`A donation with code ${code} already exists.`);
    }
    const createdAt = new Date();
    const donation: Donation = {
      ...data,
      id,
      code,
      status: "registered" as DonationStatus,
      createdAt,
      updatedAt: createdAt,
      auditHistory: [
        { event: "donation_registered", actorUid: data.intakeStaffUid, detail: `Package ${code} registered.`, at: createdAt },
      ],
    };
    this.donations.push(donation);
    // Mirror to Firestore when a project is configured (fire-and-forget).
    void syncDocument("donations", donation.id, donation);
    this.notify();
    return donation;
  }

  updateDonation(id: string, patch: Partial<Donation>): Donation | undefined {
    const idx = this.donations.findIndex((d) => d.id === id);
    if (idx === -1) return undefined;
    const existing = this.donations[idx];
    const updated = {
      ...existing,
      ...patch,
      id: existing.id,
      code: existing.code,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    const audit = Array.isArray(patch.auditHistory)
      ? [...(existing.auditHistory ?? []), ...patch.auditHistory]
      : existing.auditHistory ?? [];
    this.donations[idx] = { ...updated, auditHistory: audit };
    void syncDocument("donations", this.donations[idx].id, this.donations[idx]);
    this.notify();
    return this.donations[idx];
  }

  listStations(): Station[] { return [...this.stations]; }
  getStation(id: string): Station | undefined { return this.stations.find((s) => s.id === id); }
  updateStation(id: string, patch: Partial<Station>): Station | undefined {
    const idx = this.stations.findIndex((s) => s.id === id);
    if (idx === -1) return undefined;
    this.stations[idx] = { ...this.stations[idx], ...patch };
    void syncDocument("stations", this.stations[idx].id, this.stations[idx]);
    this.notify();
    return this.stations[idx];
  }

  /** Idempotently add a station (used by the simulator and hardware bridge). */
  ensureStation(station: Station): Station {
    const existing = this.stations.find((s) => s.id === station.id);
    if (existing) return existing;
    this.stations.push(station);
    void syncDocument("stations", station.id, station);
    this.notify();
    return station;
  }

  listLocations(): Location[] { return [...this.locations]; }
  getLocation(id: string): Location | undefined { return this.locations.find((l) => l.id === id); }
  listReferenceProducts(): ReferenceProduct[] { return [...this.referenceProducts]; }

  pushStationEvent(event: StationEvent) {
    this.stationEvents.unshift(event);
    if (this.stationEvents.length > 200) this.stationEvents.pop();
    this.notify();
  }
  listStationEvents(stationId?: string, limit = 50): StationEvent[] {
    let ev = this.stationEvents;
    if (stationId) ev = ev.filter((e) => e.stationId === stationId);
    return ev.slice(0, limit);
  }

  queueCommand(command: Omit<StationCommand, "id" | "status" | "createdAt">): StationCommand {
    const cmd: StationCommand = {
      ...command,
      id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "queued",
      createdAt: new Date(),
    };
    this.stationCommands.unshift(cmd);
    if (this.stationCommands.length > 100) this.stationCommands.pop();
    this.notify();
    return cmd;
  }
  listStationCommands(stationId?: string): StationCommand[] {
    let cmds = this.stationCommands;
    if (stationId) cmds = cmds.filter((c) => c.stationId === stationId);
    return cmds;
  }
  updateCommand(id: string, patch: Partial<StationCommand>): StationCommand | undefined {
    const idx = this.stationCommands.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.stationCommands[idx] = { ...this.stationCommands[idx], ...patch };
    this.notify();
    return this.stationCommands[idx];
  }

  getStatusLabel(status: DonationStatus): string {
    return ({
      registered: "Registered",
      awaiting_inspection: "Awaiting Inspection",
      inspection_in_progress: "Inspection In Progress",
      pending_verification: "Pending Verification",
      discrepancy_detected: "Discrepancy Detected",
      quarantined_for_review: "Quarantined for Review",
      awaiting_authorised_decision: "Awaiting Authorised Decision",
      approved_for_next_stage: "Approved for Next Stage",
      rejected: "Rejected",
      disposition_recorded: "Disposition Recorded",
    }[status] ?? status);
  }

  getStatusVariant(status: DonationStatus): "default" | "secondary" | "success" | "warning" | "destructive" | "medical" {
    return ({
      registered: "secondary",
      awaiting_inspection: "warning",
      inspection_in_progress: "medical",
      pending_verification: "warning",
      discrepancy_detected: "destructive",
      quarantined_for_review: "destructive",
      awaiting_authorised_decision: "warning",
      approved_for_next_stage: "success",
      rejected: "destructive",
      disposition_recorded: "secondary",
    }[status] as "default" | "secondary" | "success" | "warning" | "destructive" | "medical") ?? "default";
  }
}

export const dataStore = new DataStore();
