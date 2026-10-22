import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Placeholder server auth endpoint.
  // In this build, authentication is handled client-side via Firebase Auth.
  // Server-side helpers (e.g. verifying Firebase ID tokens, role lookups)
  // would be added here when production credentials are available.
  return NextResponse.json({ ok: true, note: "Client-side auth is used for the local emulator demo." });
}
