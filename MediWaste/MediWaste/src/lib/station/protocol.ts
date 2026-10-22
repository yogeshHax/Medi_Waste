import { z } from "zod";

/**
 * MedWaste VerifyPoint — station request protocol, VERSION 1.
 * Shared by:
 *   - the phone BLE client (/station/ble),
 *   - the ESP32 firmware (src/hardware/firmware/esp32),
 *   - the trusted backend (functions/),
 *   - the in-app simulator (/simulator).
 *
 * Transport (BLE): one characteristic, newline-delimited JSON per frame.
 * Transport (backend): HTTPS JSON body.
 *
 *      PHONE --BLE--> ESP32 --HTTPS--> BACKEND --> FIRESTORE
 *                <--notify------- <--
 */

export const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// Operations (workflow transitions a station can request)
// ---------------------------------------------------------------------------
export const StationOperationSchema = z.enum([
  "intake_registered", // package arrived at intake, record must exist
  "inspection_started", // moved to inspection station
  "inspection_completed", // inspection finished, requires review
  "review_decision", // authorised reviewer recorded a decision
]);
export type StationOperation = z.infer<typeof StationOperationSchema>;

// ---------------------------------------------------------------------------
// Status codes — explicit, exhaustive, quoted in the spec
// ---------------------------------------------------------------------------
export const RequestStatusSchema = z.enum([
  "REQUEST_FOUND", // record exists; no transition applied (informational)
  "REQUEST_ACCEPTED", // authorised transition applied — THE ONLY gate-opening result
  "UNKNOWN_ID", // no record with that ID exists
  "ALREADY_PROCESSED", // ID valid but this transition was already applied
  "REQUIRES_REVIEW", // valid but record is quarantined pending review
  "NOT_ELIGIBLE_FOR_NEXT_STAGE", // current state does not permit the transition
  "UNAUTHORISED", // station/identity/reviewer checks failed
  "INVALID_MESSAGE", // malformed or out-of-range protocol frame
  "NETWORK_ERROR", // transport failure reaching the backend
  "SERVER_ERROR", // backend failure
]);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------
/** Phone -> ESP32 (BLE write). */
export const BleRequestFrameSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  msgId: z.string().min(4).max(64), // unique per message, used for Ack + dedupe
  stationId: z.string().min(1).max(64),
  operation: StationOperationSchema,
  donationId: z.string().min(1).max(64),
  actorUid: z.string().max(128).optional(), // software user, if any
  sentAt: z.number().int().optional(),
});
export type BleRequestFrame = z.infer<typeof BleRequestFrameSchema>;

/** ESP32 -> backend (HTTPS JSON). Same fields + device credential. */
export type BackendRequest = BleRequestFrame & {
  deviceSerial?: string;
};

/** Backend -> ESP32 -> phone (BLE notify after Ack). */
export const BackendResponseSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  msgId: z.string(),
  ack: z.boolean(), // true = frame received & understood (no semantic meaning)
  status: RequestStatusSchema,
  donationCode: z.string().optional(), // echo of the full code for display
  currentStatus: z.string().optional(), // donation status after processing
  detail: z.string().max(200).optional(),
  appliedAt: z.number().int().optional(), // server millis
});
export type BackendResponse = z.infer<typeof BackendResponseSchema>;

/** ESP32 -> phone (BLE notify, same-frame acknowledgement of delivery only). */
export const BleAckFrameSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.literal("ack"),
  echo: z.string(),
});
export const BleErrorFrameSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.literal("error"),
  reason: z.enum(["malformed", "unsupported_version", "busy", "duplicate"]),
  echo: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Donor/station state machine
// ---------------------------------------------------------------------------
/**
 * Which donation statuses permit which operations. An existing record is NEVER
 * sufficient to approve medicine for reuse — only `review_decision` by an
 * authorised reviewer advances eligibility.
 */
export const PERMITTED_TRANSITIONS: Record<
  StationOperation,
  { from: string[]; to: string }
> = {
  intake_registered: {
    from: ["awaiting_inspection"],
    to: "awaiting_inspection", // informational check-in at an intake station
  },
  inspection_started: {
    from: ["awaiting_inspection", "inspection_in_progress"],
    to: "inspection_in_progress",
  },
  inspection_completed: {
    from: ["inspection_in_progress"],
    to: "pending_verification",
  },
  review_decision: {
    from: ["pending_verification", "quarantined_for_review", "awaiting_authorised_decision"],
    to: "awaiting_authorised_decision", // dashboard records the actual decision
  },
};

/**
 * Decide the response status for a request WITHOUT writing anything.
 * Pure function — used identically by the Cloud Function, the local fallback
 * and the simulator, so every path applies the same rules.
 * Returns { status, currentStatus, authorised } — authorised is only true when
 * the transition may be applied.
 */
export function evaluateTransition(params: {
  operation: StationOperation;
  donation: { status: string; code: string } | null;
  appliedMsgIds?: string[]; // ALREADY_PROCESSED dedupe (server-side persistent)
  alreadyProcessed?: boolean;
}): {
  status: RequestStatus;
  currentStatus?: string;
  authorised: boolean;
} {
  const { operation, donation } = params;

  if (!donation) return { status: "UNKNOWN_ID", authorised: false };
  if (params.alreadyProcessed)
    return { status: "ALREADY_PROCESSED", currentStatus: donation.status, authorised: false };

  const rule = PERMITTED_TRANSITIONS[operation];
  if (!rule.from.includes(donation.status))
    return { status: "NOT_ELIGIBLE_FOR_NEXT_STAGE", currentStatus: donation.status, authorised: false };

  return { status: "REQUEST_ACCEPTED", currentStatus: rule.to, authorised: true };
}

/** Results that authorise opening the physical gate. Exactly one. */
export function gateMayOpen(status: RequestStatus): boolean {
  return status === "REQUEST_ACCEPTED";
}

/** Human-readable one-liner for LCD/status displays (all < 32 chars). */
export function statusHeadline(status: RequestStatus): string {
  const map: Record<RequestStatus, string> = {
    REQUEST_FOUND: "Record found",
    REQUEST_ACCEPTED: "Accepted - gate open",
    UNKNOWN_ID: "ID not recognised",
    ALREADY_PROCESSED: "Already processed",
    REQUIRES_REVIEW: "Review required",
    NOT_ELIGIBLE_FOR_NEXT_STAGE: "Not eligible now",
    UNAUTHORISED: "Not authorised",
    INVALID_MESSAGE: "Bad message",
    NETWORK_ERROR: "Network error",
    SERVER_ERROR: "Server error",
  };
  return map[status];
}
