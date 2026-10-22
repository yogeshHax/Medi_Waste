"use client";

import { useSyncExternalStore } from "react";
import { dataStore } from "@/lib/data-store";

/**
 * Re-render the calling client component whenever the demo data store changes.
 *
 * The store itself is framework-agnostic (and used by server components for the
 * initial snapshot), so the subscription lives here instead of inside it.
 */
export function useDataStoreVersion(): number {
  return useSyncExternalStore(
    dataStore.subscribe,
    dataStore.getVersion,
    dataStore.getVersion
  );
}
