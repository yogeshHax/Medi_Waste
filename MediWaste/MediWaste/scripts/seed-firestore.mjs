/**
 * Seeds the connected Firebase project with the app's fictional demo data.
 *
 *   node scripts/seed-firestore.mjs
 *
 * - Reads NEXT_PUBLIC_FIREBASE_* from .env.local
 * - Signs in with the demo account (created on first run)
 * - Writes to the app's namespaced collections (medwaste_*)
 *
 * Requires firestore.rules to allow signed-in writes:
 *   firebase deploy --only firestore:rules
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const DEMO_EMAIL = process.env.MEDWASTE_DEMO_EMAIL || "medwaste-demo@example.org";
const DEMO_PASSWORD = process.env.MEDWASTE_DEMO_PASSWORD || "DemoPass123";

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const config = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!config.apiKey || !config.projectId) {
  console.error("Missing Firebase config in .env.local");
  process.exit(1);
}

const PREFIX = "medwaste_";
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

const LOCATIONS = [
  { id: "loc-1", name: "MedWaste Central Intake", address: "12 Central Depot Road", isActive: true },
  { id: "loc-2", name: "Community Pharmacy Hub", address: "8 Market Street", isActive: true },
];

const STATIONS = [
  { id: "station-a", name: "Verification Station A", code: "MW-VS-A-001", locationId: "loc-1", status: "online", gateState: "closed" },
  { id: "station-b", name: "Verification Station B", code: "MW-VS-B-002", locationId: "loc-2", status: "offline", gateState: "closed" },
];

const DONATIONS = [
  {
    id: "don-1",
    code: "MW-AB12CD34",
    status: "pending_verification",
    expiryDate: new Date("2027-03-01"),
    packageInfo: {
      description: "Paracetamol 500mg tablets",
      form: "Tablet",
      strength: "500mg",
      manufacturer: "Fictional Pharma Co",
      batchNumber: "PMC2024-001",
      quantity: 50,
      unit: "tablets",
      notes: "Demo record — fictional data only.",
    },
    donorInfo: { name: "Community Donation Box", contact: "admin@example.org" },
    intakeLocationId: "loc-1",
    intakeStaffUid: "user-intake-1",
  },
  {
    id: "don-2",
    code: "MW-EF56GH78",
    status: "awaiting_inspection",
    expiryDate: new Date("2026-06-30"),
    packageInfo: {
      description: "Amoxicillin 250mg capsules",
      form: "Capsule",
      strength: "250mg",
      manufacturer: "Fictional Pharma Co",
      batchNumber: "AMP2024-042",
      quantity: 28,
      unit: "capsules",
      notes: "Demo record — fictional data only.",
    },
    donorInfo: { name: "Riverside Clinic" },
    intakeLocationId: "loc-2",
    intakeStaffUid: "user-intake-1",
  },
  {
    id: "don-3",
    code: "MW-IJ90KL12",
    status: "discrepancy_detected",
    expiryDate: new Date("2025-01-10"),
    packageInfo: {
      description: "Lisinopril 10mg tablets",
      form: "Tablet",
      strength: "10mg",
      manufacturer: "Fictional Pharma Co",
      batchNumber: "LSN2023-888",
      quantity: 100,
      unit: "tablets",
      notes: "Demo record — fictional data only.",
    },
    donorInfo: { name: "Community Donation Box" },
    intakeLocationId: "loc-1",
    intakeStaffUid: "user-intake-2",
  },
];

async function signInDemoUser() {
  try {
    const cred = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
    return cred.user;
  } catch (error) {
    if (["auth/user-not-found", "auth/invalid-credential", "auth/invalid-login-credentials"].includes(error?.code)) {
      const cred = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
      console.log(`Created demo account ${DEMO_EMAIL}`);
      return cred.user;
    }
    throw error;
  }
}

async function writeAll(name, rows, extra = {}) {
  for (const row of rows) {
    const { id, ...rest } = row;
    await setDoc(
      doc(db, `${PREFIX}${name}`, id),
      { ...rest, ...extra, isDemoData: true, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }
  const snap = await getDocs(collection(db, `${PREFIX}${name}`));
  console.log(`  ${PREFIX}${name}: wrote ${rows.length}, collection now has ${snap.size}`);
}

try {
  console.log(`Seeding Firebase project "${config.projectId}" ...\n`);
  const user = await signInDemoUser();
  console.log(`Signed in as ${user.email} (${user.uid})\n`);
  await writeAll("locations", LOCATIONS);
  await writeAll("stations", STATIONS);
  await writeAll("donations", DONATIONS, { createdAt: serverTimestamp() });
  console.log("\nSeed complete.");
  process.exit(0);
} catch (error) {
  console.error("\nSeed failed:", error?.code || "", error?.message || error);
  if (error?.code === "permission-denied") {
    console.error(
      "\nFirestore rejected the write. Publish the repo's rules for this project, then re-run:\n" +
        "  firebase login\n" +
        "  firebase deploy --only firestore:rules\n"
    );
  }
  process.exit(1);
}
