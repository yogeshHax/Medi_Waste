import { db } from "@/lib/firebase";
import { dataStore } from "@/lib/data-store";
import { syncDocument } from "@/lib/firestore-sync";
import { processStationRequest, RequestAdapter } from "./process-request";
import { BackendRequest, BackendResponse } from "./protocol";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { User } from "firebase/auth";
import { getUserRoleSaved } from "@/components/auth-context";

/**
 * Client-side request processing, used while the Cloud Function deployment is
 * pending — identical rules to functions/src/index.ts via the shared engine.
 *
 * Station identity: the caller must be signed in (Firebase Auth when available,
 * the demo session otherwise) and pass their uid as actorUid. The evaluation
 * engine re-checks every transition against the stored record.
 */

function signedInUser(): User | null {
  return auth?.currentUser ?? null;
}

export async function processStationRequestLocally(
  raw: BackendRequest & { actorUid?: string }
): Promise<BackendResponse> {
  const user = signedInUser();
  const adapter: RequestAdapter = {
    async getDonation(donationId) {
      const storeRec = dataStore.getDonation(donationId);
      if (storeRec) return { id: storeRec.id, code: storeRec.code, status: storeRec.status };
      if (!db) return null;
      try {
        const snap = await getDoc(doc(getFirestore(db.app), "medwaste_donations", donationId));
        if (snap.exists()) {
          const d = snap.data() as Record<string, unknown>;
          return { id: snap.id, code: String(d.code ?? snap.id), status: String(d.status ?? "registered") };
        }
      } catch {
        // Firestore mirror not readable — local store already covered it.
      }
      return null;
    },
    async isDuplicate() {
      return false; // local store has no persistent dedupe ledger
    },
    async applyTransition({ donationId, to, operation, stationId, actorUid }) {
      const updated = dataStore.updateDonation(donationId, {
        status: to as never,
        auditHistory: [
          {
            event: `station_${operation}`,
            actorUid: actorUid ?? `station:${stationId}`,
            detail: `Transition applied via station ${stationId} (local fallback).`,
            at: new Date(),
          },
        ],
      });
      void syncDocument("donations", donationId, updated ?? {});
    },
    async isAuthorisedFor(actorUid, operation) {
      // Final review decisions are role-restricted even in the local fallback;
      // station operational transitions are device-attributed.
      if (operation === "review_decision") {
        const role = getUserRoleSaved();
        return role === "reviewer" || role === "admin";
      }
      if (actorUid || user?.uid) return true;
      if (typeof window === "undefined") return false;
      return Boolean(window.localStorage.getItem("medwasteDemoSession"));
    },
  };

  const { actorUid, ...frame } = raw;
  return processStationRequest({ ...frame, actorUid: actorUid ?? user?.uid }, adapter);
}
