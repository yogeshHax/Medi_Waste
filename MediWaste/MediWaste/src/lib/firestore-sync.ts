"use client";

// ---------------------------------------------------------------------------
// Best-effort Firestore mirror
// ---------------------------------------------------------------------------
// The app's UI runs on the in-memory data store so it always works. When a real
// Firebase project is configured, every mutation is also written to Firestore.
// Writes are fire-and-forget: a rules/permission failure is reported once in the
// console and never blocks the UI.
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db, FIREBASE_AVAILABLE } from "@/lib/firebase";

/** Collections are namespaced so they never collide with other project data. */
const PREFIX = "medwaste_";

let warned = false;
let lastStatus: "idle" | "ok" | "denied" | "error" = "idle";

export function getSyncStatus() {
  return lastStatus;
}

export function isSyncEnabled() {
  return FIREBASE_AVAILABLE && Boolean(db);
}

function reportError(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  lastStatus = code === "permission-denied" ? "denied" : "error";
  if (warned) return;
  warned = true;
  if (code === "permission-denied") {
    console.warn(
      "[firestore] Writes are blocked by security rules. The app keeps working on local demo data. " +
        "Deploy the repo's firestore.rules (npm run deploy:rules) to enable syncing."
    );
  } else {
    console.warn("[firestore] Sync unavailable, continuing locally:", error);
  }
}

/** Drop undefined values so Firestore does not reject the document. */
function clean<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as T;
}

export async function syncDocument(
  name: string,
  id: string,
  data: Record<string, unknown>
) {
  if (!isSyncEnabled() || !db || typeof window === "undefined") return;
  try {
    await setDoc(
      doc(db, `${PREFIX}${name}`, id),
      { ...clean(data), updatedAt: serverTimestamp() },
      { merge: true }
    );
    lastStatus = "ok";
  } catch (error) {
    reportError(error);
  }
}

export async function syncEvent(name: string, data: Record<string, unknown>) {
  if (!isSyncEnabled() || !db || typeof window === "undefined") return;
  try {
    await addDoc(collection(db, `${PREFIX}${name}`), {
      ...clean(data),
      createdAt: serverTimestamp(),
    });
    lastStatus = "ok";
  } catch (error) {
    reportError(error);
  }
}
