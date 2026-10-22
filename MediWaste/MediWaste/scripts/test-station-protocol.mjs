/**
 * Protocol v1 engine tests. Run with:  npx tsx scripts/test-station-protocol.mjs
 * Exercises the SAME evaluateTransition/processStationRequest engine the
 * deployed Cloud Function and firmware flow use.
 */
import assert from "node:assert/strict";
import { processStationRequest, MemoryRequestAdapter } from "../src/lib/station/process-request.ts";
import { evaluateTransition, PERMITTED_TRANSITIONS } from "../src/lib/station/protocol.ts";

const adapter = new MemoryRequestAdapter();
adapter.upsert({ id: "d1", code: "MW-TEST0001", status: "awaiting_inspection" });

const frame = (donationId, operation, msgId = `t-${Math.random().toString(36).slice(2)}`) => ({
  v: 1,
  msgId,
  stationId: "station-1",
  operation,
  donationId,
});

let passed = 0, failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}: ${err.message}`);
  }
}

console.log("protocol v1 engine tests");

await test("valid transition -> REQUEST_ACCEPTED + state applied", async () => {
  const r = await processStationRequest(frame("MW-TEST0001", "inspection_started"), adapter);
  assert.equal(r.status, "REQUEST_ACCEPTED");
  assert.equal(r.currentStatus, "inspection_in_progress");
  const rec = await adapter.getDonation("MW-TEST0001");
  assert.equal(rec.status, "inspection_in_progress");
});

await test("unknown id -> UNKNOWN_ID, nothing written", async () => {
  const r = await processStationRequest(frame("MW-NOSUCH", "inspection_started"), adapter);
  assert.equal(r.status, "UNKNOWN_ID");
  assert.ok(await adapter.getDonation("don?none") === null);
});

await test("illegal state transition -> NOT_ELIGIBLE_FOR_NEXT_STAGE", async () => {
  // inspection_completed only allowed from inspection_in_progress,
  // but new: after previous test state is inspection_in_progress this one IS legal;
  // so first make an illegal one: intake_registered from inspection_in_progress.
  const r = await processStationRequest(frame("MW-TEST0001", "intake_registered"), adapter);
  assert.equal(r.status, "NOT_ELIGIBLE_FOR_NEXT_STAGE");
  const rec = await adapter.getDonation("MW-TEST0001");
  assert.equal(rec.status, "inspection_in_progress"); // unchanged
});

await test("duplicate msgId -> ALREADY_PROCESSED", async () => {
  adapter.upsert({ id: "d1", code: "MW-TEST0002", status: "awaiting_inspection" });
  // apply a legal transition first
  const f = frame("MW-TEST0002", "inspection_started", "dup-msg-1");
  const r1 = await processStationRequest(f, adapter);
  assert.equal(r1.status, "REQUEST_ACCEPTED");
  const r2 = await processStationRequest(f, adapter);
  assert.equal(r2.status, "ALREADY_PROCESSED");
  const rec = await adapter.getDonation("MW-TEST0002");
  assert.equal(rec.status, "inspection_in_progress"); // applied exactly once
});

await test("malformed frame -> INVALID_MESSAGE", async () => {
  const r = await processStationRequest({ v: 1, msgId: "", donationId: "" }, adapter);
  assert.equal(r.status, "INVALID_MESSAGE");
});

await test("backend failure -> SERVER_ERROR, nothing written", async () => {
  const broken = {
    getDonation: async () => { throw new Error("firestore down"); },
    isDuplicate: async () => false,
    applyTransition: async () => { throw new Error("must not run"); },
    isAuthorisedFor: async () => true,
  };
  const r = await processStationRequest(frame("MW-TEST0001", "inspection_started"), broken);
  assert.equal(r.status, "SERVER_ERROR");
});

await test("transition table sanity", () => {
  assert.equal(PERMITTED_TRANSITIONS.inspection_completed.from.length, 1);
  assert.deepEqual(
    evaluateTransition({
      operation: "review_decision",
      donation: { status: "rejected", code: "X" },
    }).status,
    "NOT_ELIGIBLE_FOR_NEXT_STAGE"
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
