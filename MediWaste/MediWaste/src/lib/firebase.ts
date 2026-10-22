import {
  initializeApp,
  getApps,
  getApp,
  FirebaseApp,
} from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  Firestore,
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// Firebase initialisation
// ---------------------------------------------------------------------------
// Firebase is optional. The app ships with an in-memory demo data store, so it
// runs with no credentials and no emulators. Firebase is only used when either
//   - NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true (local Emulator Suite), or
//   - real NEXT_PUBLIC_FIREBASE_* values are supplied.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const USE_EMULATORS =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

const hasRealConfig =
  Boolean(firebaseConfig.apiKey) &&
  firebaseConfig.apiKey !== "REPLACE_ME" &&
  Boolean(firebaseConfig.projectId) &&
  firebaseConfig.projectId !== "REPLACE_ME";

/** True when a real Firebase project or the local emulator is available. */
export const FIREBASE_AVAILABLE = USE_EMULATORS || hasRealConfig;

const EMULATOR_HOST = "127.0.0.1";
export const AUTH_EMULATOR_URL = `http://${EMULATOR_HOST}:9099`;
export const FIRESTORE_EMULATOR_PORT = 8085;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (FIREBASE_AVAILABLE) {
  const config = USE_EMULATORS
    ? { projectId: "demo-medwaste", apiKey: "demo-medwaste-local-key" }
    : firebaseConfig;

  app = getApps().length ? getApp() : initializeApp(config);

  try {
    auth = getAuth(app);
  } catch (error) {
    console.warn("[firebase] Auth is unavailable, continuing without it:", error);
  }
  try {
    db = getFirestore(app);
  } catch (error) {
    console.warn("[firebase] Firestore is unavailable, continuing without it:", error);
  }
}

let emulatorsConnected = false;

/**
 * Point the SDK at the local Emulator Suite. Only used when the emulator flag is
 * switched on; safe to call repeatedly and a no-op on the server.
 */
export function initEmulators() {
  if (emulatorsConnected || !USE_EMULATORS || typeof window === "undefined") return;
  if (!auth || !db) return;

  const host = window.location.hostname;
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (!isLocal) return;

  try {
    connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
    emulatorsConnected = true;
  } catch (error) {
    console.warn("[firebase] Could not connect to the emulators:", error);
  }
}

export { app, auth, db };

// ---------------------------------------------------------------------------
// User helper
// ---------------------------------------------------------------------------
export async function getCurrentUser() {
  return auth?.currentUser ?? null;
}

export async function fetchUserRole(_uid: string): Promise<import("../types").User | null> {
  // In production this reads from a users collection. Locally we rely on the
  // in-memory demo store. Placeholder implementation.
  return null;
}
