import { z } from "zod";

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const RoleSchema = z.enum(["admin", "reviewer", "intake", "viewer"]);
export type Role = z.infer<typeof RoleSchema>;

// ---------------------------------------------------------------------------
// Users / Auth
// ---------------------------------------------------------------------------
export const UserSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().optional(),
  role: RoleSchema,
  createdAt: z.date().or(z.string()),
});
export type User = z.infer<typeof UserSchema>;

// ---------------------------------------------------------------------------
// Locations / Stations
// ---------------------------------------------------------------------------
export const LocationSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  address: z.string().optional(),
  createdAt: z.date().or(z.string()),
});
export type Location = z.infer<typeof LocationSchema>;

export const StationSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  locationId: z.string(),
  serialNumber: z.string().optional(),
  online: z.boolean(),
  lastHeartbeat: z.date().or(z.string()).optional(),
  gateState: z.enum(["open", "closed"]).default("closed"),
  createdAt: z.date().or(z.string()),
});
export type Station = z.infer<typeof StationSchema>;

// ---------------------------------------------------------------------------
// Donations / Packages
// ---------------------------------------------------------------------------
export const DonationStatusSchema = z.enum([
  "registered",
  "awaiting_inspection",
  "inspection_in_progress",
  "pending_verification",
  "discrepancy_detected",
  "quarantined_for_review",
  "awaiting_authorised_decision",
  "approved_for_next_stage",
  "rejected",
  "disposition_recorded",
]);
export type DonationStatus = z.infer<typeof DonationStatusSchema>;

export const DonationSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  status: DonationStatusSchema,
  packageInfo: z
    .object({
      description: z.string().optional(),
      form: z.string().optional(),
      strength: z.string().optional(),
      manufacturer: z.string().optional(),
      batchNumber: z.string().optional(),
      expiryDate: z.date().or(z.string()).optional(),
      quantity: z.number().int().positive().optional(),
      unit: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  donorInfo: z
    .object({
      name: z.string().min(1),
      contact: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  intakeLocationId: z.string().optional(),
  intakeStaffUid: z.string().optional(),
  intakeAt: z.date().or(z.string()).optional(),
  inspection: z
    .object({
      startedByUid: z.string().optional(),
      startedAt: z.date().or(z.string()).optional(),
      completedByUid: z.string().optional(),
      completedAt: z.date().or(z.string()).optional(),
      observations: z.array(z.string()).optional(),
      evidenceRefs: z.array(z.string()).optional(),
      verificationOutcome: z.string().optional(),
      verificationReason: z.string().optional(),
    })
    .optional(),
  verificationChecks: z.array(
    z.object({
      checkId: z.string(),
      name: z.string(),
      result: z.enum(["pass", "fail", "inconclusive", "not_run"]),
      detail: z.string().optional(),
      source: z.string(),
      at: z.date().or(z.string()),
    })
  ).optional(),
  discrepancies: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      detail: z.string(),
      status: z.enum(["open", "resolved", "waived"]),
      reportedByUid: z.string().optional(),
      reportedAt: z.date().or(z.string()).optional(),
      resolvedByUid: z.string().optional(),
      resolvedAt: z.date().or(z.string()).optional(),
      resolution: z.string().optional(),
    })
  ).optional(),
  review: z
    .object({
      reviewerUid: z.string().optional(),
      decision: z.enum(["approved", "rejected", "pending"]).optional(),
      reason: z.string().optional(),
      reviewedAt: z.date().or(z.string()).optional(),
    })
    .optional(),
  handoverChain: z.array(
    z.object({
      id: z.string(),
      fromUid: z.string(),
      toUid: z.string(),
      fromRole: RoleSchema.optional(),
      toRole: RoleSchema.optional(),
      note: z.string().optional(),
      at: z.date().or(z.string()),
    })
  ).optional(),
  disposition: z
    .object({
      type: z.enum(["reuse_eligible", "destroy", "return_to_supplier", "held", "other"]).optional(),
      authorisedByUid: z.string().optional(),
      authorisedAt: z.date().or(z.string()).optional(),
      note: z.string().optional(),
    })
    .optional(),
  auditHistory: z.array(
    z.object({
      event: z.string(),
      actorUid: z.string().optional(),
      detail: z.string().optional(),
      at: z.date().or(z.string()),
    })
  ).optional(),
  updatedAt: z.date().or(z.string()),
  createdAt: z.date().or(z.string()),
});
export type Donation = z.infer<typeof DonationSchema>;

export const CreateDonationSchema = z.object({
  code: z.string().min(1),
  packageInfo: DonationSchema.shape.packageInfo.optional(),
  donorInfo: DonationSchema.shape.donorInfo.optional(),
  intakeLocationId: z.string().optional(),
  intakeStaffUid: z.string(),
}).merge(
  z.object({
    intakeStaffUid: z.string(),
  })
);

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------
export const StartInspectionSchema = z.object({
  donationId: z.string(),
  startedByUid: z.string(),
});
export const CompleteInspectionSchema = z.object({
  donationId: z.string(),
  completedByUid: z.string(),
  observations: z.array(z.string()),
  evidenceRefs: z.array(z.string()).optional(),
  verificationOutcome: z.string(),
  verificationReason: z.string(),
});

// ---------------------------------------------------------------------------
// Verification checks
// ---------------------------------------------------------------------------
export const VerificationCheckSchema = z.object({
  checkId: z.string(),
  name: z.string(),
  result: z.enum(["pass", "fail", "inconclusive", "not_run"]),
  detail: z.string().optional(),
  source: z.string(),
  at: z.date().or(z.string()),
});
// Station event — a sensor/event reported by a station or the simulator
export const StationEventSchema = z.object({
  stationId: z.string(),
  type: z.enum([
    "heartbeat",
    "sensor_ir",
    "sensor_ultrasonic",
    "gate_state",
    "servo_position",
    "lcd_message",
    "status_led",
    "keypad",
    "bt_message",
    "beep",
  ]),
  payload: z.unknown(),
  receivedAt: z.date().or(z.string()),
});
export type StationEvent = z.infer<typeof StationEventSchema>;

// Station command — a command queued for a station
export const StationCommandSchema = z.object({
  id: z.string(),
  stationId: z.string(),
  type: z.enum([
    "open_gate",
    "close_gate",
    "set_servo",
    "lcd_display",
    "status_led",
    "beep",
  ]),
  payload: z.unknown(),
  status: z.enum(["queued", "sent", "acknowledged", "rejected", "timeout"]).default("queued"),
  createdAt: z.date().or(z.string()),
  sentAt: z.date().or(z.string()).optional(),
  acknowledgedAt: z.date().or(z.string()).optional(),
  expiresAt: z.date().or(z.string()).optional(),
});
export type StationCommand = z.infer<typeof StationCommandSchema>;


export type VerificationCheck = z.infer<typeof VerificationCheckSchema>;

// ---------------------------------------------------------------------------
// Discrepancies
// ---------------------------------------------------------------------------
export const ReportDiscrepancySchema = z.object({
  donationId: z.string(),
  title: z.string().min(1),
  detail: z.string().min(1),
  reportedByUid: z.string(),
});
export const ResolveDiscrepancySchema = z.object({
  donationId: z.string(),
  discrepancyId: z.string(),
  resolution: z.string().min(1),
  resolvedByUid: z.string(),
});

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------
export const ReviewDecisionSchema = z.object({
  donationId: z.string(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().min(1),
  reviewedByUid: z.string(),
});

// ---------------------------------------------------------------------------
// Handovers
// ---------------------------------------------------------------------------
export const HandoverSchema = z.object({
  donationId: z.string(),
  fromUid: z.string(),
  toUid: z.string(),
  note: z.string().optional(),
  at: z.date().or(z.string()),
});
export type Handover = z.infer<typeof HandoverSchema>;

export const RecordHandoverSchema = z.object({
  donationId: z.string(),
  fromUid: z.string(),
  toUid: z.string(),
  note: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Dispositions
// ---------------------

// ---------------------------------------------------------------------------
// Reference products (fictional seed for verification checks)
// ---------------------------------------------------------------------------
export const ReferenceProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  manufacturer: z.string().optional(),
  form: z.string().optional(),
  strength: z.string().optional(),
  batchPattern: z.string().optional(),
  notes: z.string().optional(),
  isFictional: z.boolean().default(true),
});
export type ReferenceProduct = z.infer<typeof ReferenceProductSchema>;
