import {
  BackendRequest,
  BackendResponse,
  BleRequestFrameSchema,
  PROTOCOL_VERSION,
  evaluateTransition,
  statusHeadline,
} from "./protocol";

/**
 * processStationRequest — the single trusted request-processing operation.
 *
 * The business rules live here (no I/O), so the exact same logic runs in:
 *   1. functions/src/index.ts     — deployed Cloud Function (trusted backend)
 *   2. src/lib/station/request-client.ts — signed-in client fallback while the
 *      deployment is pending
 *   3. the /simulator panel       — repeatable lifecycle tests
 *
 * The caller supplies an adapter (lookup/apply/dedupe/audit) for its storage
 * layer. Nothing here trusts client-supplied state: transitions are evaluated
 * against the record that the storage layer returns.
 */

export interface RequestAdapter {
  /** Look up a donation by its exact ID/code. Return null when unknown. */
  getDonation(donationId: string): Promise<
    { id: string; code: string; status: string } | null
  >;
  /** Has this msgId already been applied for this donation? */
  isDuplicate(msgId: string, donationId: string): Promise<boolean>;
  /** Atomically apply the transition and record the audit event. */
  applyTransition(params: {
    donationId: string;
    from: string;
    to: string;
    operation: string;
    msgId: string;
    stationId: string;
    actorUid?: string;
  }): Promise<void>;
  /** Who is allowed to make this request at all? (null actor = station device) */
  isAuthorisedFor(actorUid: string | undefined, operation: string): Promise<boolean>;
}

// Minimal in-memory adapter used by the simulator and tests.
export class MemoryRequestAdapter implements RequestAdapter {
  private records = new Map<string, { id: string; code: string; status: string }>();
  private appliedKeys = new Set<string>();

  upsert(rec: { id: string; code: string; status: string }) {
    this.records.set(rec.id, { ...rec });
  }

  async getDonation(donationId: string) {
    return (
      this.records.get(donationId) ??
      [...this.records.values()].find((r) => r.code === donationId) ??
      null
    );
  }

  async isDuplicate(msgId: string, donationId: string) {
    return this.appliedKeys.has(`${donationId}:${msgId}`);
  }

  async applyTransition(p: {
    donationId: string;
    from: string;
    to: string;
    operation: string;
    msgId: string;
    stationId: string;
  }) {
    this.appliedKeys.add(`${p.donationId}:${p.msgId}`);
    const rec = this.records.get(p.donationId);
    if (rec) rec.status = p.to;
  }

  async isAuthorisedFor(actorUid?: string, operation?: string) {
    // simulator stations are trusted; args accepted for interface parity
    void actorUid; void operation;
    return true;
  }
}

export async function processStationRequest(
  raw: BackendRequest,
  adapter: RequestAdapter
): Promise<BackendResponse> {
  const respond = (
    status: BackendResponse["status"],
    extra: Partial<BackendResponse> = {}
  ): BackendResponse => ({
    v: PROTOCOL_VERSION,
    msgId: typeof raw?.msgId === "string" ? raw.msgId : "",
    ack: true,
    status,
    detail: extra.detail ?? statusHeadline(status),
    appliedAt: Date.now(),
    ...extra,
  });

  // 1. Validate the message shape against the shared protocol schema. Checking
  //    types by hand let empty IDs and unknown operations reach the lookup.
  const parsed = BleRequestFrameSchema.safeParse(raw);
  if (!parsed.success) {
    return respond("INVALID_MESSAGE", {
      detail: parsed.error.issues[0]?.message ?? statusHeadline("INVALID_MESSAGE"),
    });
  }
  raw = { ...parsed.data, deviceSerial: raw?.deviceSerial } as BackendRequest;

  try {
    // 2. Authenticate / authorise the caller. A "review_decision" operation
    //    additionally requires a reviewer/admin identity.
    const authorised = await adapter.isAuthorisedFor(raw.actorUid, raw.operation);
    if (!authorised) return respond("UNAUTHORISED");

    // 3. Look up the exact donation ID (server-side — never trust client state).
    const donation = await adapter.getDonation(raw.donationId);

    // 4. Duplicate-detection before anything else.
    const alreadyProcessed = donation
      ? await adapter.isDuplicate(raw.msgId, donation.id)
      : false;

    // 5. Evaluate whether this transition is permitted from the current state.
    const result = evaluateTransition({
      operation: raw.operation,
      donation,
      alreadyProcessed,
    });

    if (result.status === "UNKNOWN_ID") return respond("UNKNOWN_ID");
    if (result.status === "ALREADY_PROCESSED")
      return respond("ALREADY_PROCESSED", { currentStatus: result.currentStatus });
    if (result.status === "NOT_ELIGIBLE_FOR_NEXT_STAGE")
      return respond("NOT_ELIGIBLE_FOR_NEXT_STAGE", { currentStatus: result.currentStatus });

    // 6. Apply the permitted transition atomically and record the audit trail.
    if (result.authorised && donation) {
      await adapter.applyTransition({
        donationId: donation.id,
        from: donation.status,
        to: result.currentStatus!,
        operation: raw.operation,
        msgId: raw.msgId,
        stationId: raw.stationId,
        actorUid: raw.actorUid,
      });
      return respond("REQUEST_ACCEPTED", {
        currentStatus: result.currentStatus,
        donationCode: donation.code,
      });
    }

    return respond(result.status, { currentStatus: result.currentStatus });
  } catch (error) {
    return respond("SERVER_ERROR", {
      detail: `Backend failure: ${(error as Error)?.message?.slice(0, 120) ?? "unknown"}`,
    });
  }
}
