"use client";

/**
 * Shared simulator event bus.
 *
 * A tiny pub/sub store that both the in-app simulator (/simulator) and the
 * floating Simulation Dock broadcast through. The 3D hero, telemetry bento
 * and live serial feed subscribe to it so the home screen mirrors real
 * station/simulator state — never fake animation glued to no data source.
 *
 * Every synthetic event is flagged `simulated: true` when it originates from
 * the dock or simulator engine; consumers must render their amber
 * [SIMULATED DATA] badge for flagged events (see <SimBadge/>).
 */

import { PROTOCOL_VERSION } from "@/lib/station/protocol";

export type SimEventType =
  | "STATION_CONNECT"
  | "STATION_DISCONNECT"
  | "IR_PLACED"
  | "IR_REMOVED"
  | "BLE_CONNECTED"
  | "BLE_DISCONNECTED"
  | "ULTRASONIC_SAMPLE"
  | "LCD_MSG"
  | "REQUEST_ACCEPTED"
  | "REQUEST_REJECTED"
  | "GATE_ACK_TIMEOUT" // fault: command not acknowledged in time
  | "INVALID_DISTANCE" // fault: sensor reading out of range
  | "DUPLICATE_PACKET" // fault: retransmitted serial/frame payload
  | "MALFORMED_PAYLOAD" // fault: unparseable frame
  | "DELAYED_MESSAGE"; // fault: transport delay beyond SLA

export interface SimEvent {
  id: string;
  at: number;
  type: SimEventType;
  /** High-contrast marker for synthetic data. */
  simulated: boolean;
  msgId?: string;
  stationId?: string;
  distanceCm?: number;
  fillPercent?: number;
  status?:
    | "REQUEST_ACCEPTED"
    | "UNKNOWN_ID"
    | "ALREADY_PROCESSED"
    | "REQUIRES_REVIEW"
    | "NOT_ELIGIBLE_FOR_NEXT_STAGE"
    | "UNAUTHORISED"
    | "INVALID_MESSAGE"
    | "NETWORK_ERROR"
    | "SERVER_ERROR"
    | "REQUEST_FOUND";
  note?: string;
  // raw transport frame used for fault injection (duplicate / malformed)
  frame?: string;
}

type Listener = (e: SimEvent) => void;

const listeners = new Set<Listener>();
const history: SimEvent[] = [];
const HISTORY_LIMIT = 40;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `ev-${Date.now().toString(36)}-${counter}`;
}

export function emitSimEvent(e: Omit<SimEvent, "id" | "at"> & { at?: number }): SimEvent {
  const full: SimEvent = { id: nextId(), at: e.at ?? Date.now(), ...e } as SimEvent;
  history.unshift(full);
  if (history.length > HISTORY_LIMIT) history.pop();
  listeners.forEach((fn) => {
    try {
      fn(full);
    } catch {
      // never let one listener break the others
    }
  });
  return full;
}

export function subscribeSimEvents(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function recentSimEvents(): SimEvent[] {
  return [...history];
}

/** Dedupe window for transport-level (seq/msgId) retries. */
const recentMsgIds = new Map<string, number>();
export function isDuplicateMessage(msgId: string): boolean {
  const now = Date.now();
  const prev = recentMsgIds.get(msgId);
  recentMsgIds.set(msgId, now);
  // expire entries older than 60 s
  recentMsgIds.forEach((t, k) => {
    if (now - t > 60_000) recentMsgIds.delete(k);
  });
  return prev !== undefined;
}

/** Derived station/hero state shared by the hero and HUD cards. */
export interface StationHudState {
  online: boolean;
  bleConnected: boolean;
  irActive: boolean;
  fillPercent: number | null;
  distanceCm: number | null;
  lastStatus: SimEvent["status"] | null;
  /** True when the latest state change came from the simulator engine. */
  simulated: boolean;
}

let hud: StationHudState = {
  online: false,
  bleConnected: false,
  irActive: false,
  fillPercent: null,
  distanceCm: null,
  lastStatus: null,
  simulated: false,
};

const hudListeners = new Set<(s: StationHudState) => void>();

function applyToHud(e: SimEvent) {
  // Every derived state remembers whether its source was synthetic, so the UI
  // can label simulated telemetry honestly instead of showing it as live data.
  const base = { ...hud, simulated: e.simulated };
  switch (e.type) {
    case "STATION_CONNECT":
      hud = { ...base, online: true };
      break;
    case "STATION_DISCONNECT":
      hud = { ...base, online: false, bleConnected: false, irActive: false };
      break;
    case "BLE_CONNECTED":
      hud = { ...base, bleConnected: true };
      break;
    case "BLE_DISCONNECTED":
      hud = { ...base, bleConnected: false };
      break;
    case "IR_PLACED":
      hud = { ...base, irActive: true };
      break;
    case "IR_REMOVED":
      hud = { ...base, irActive: false };
      break;
    case "ULTRASONIC_SAMPLE": {
      const inRange =
        typeof e.distanceCm === "number" && e.distanceCm >= 2 && e.distanceCm <= 400;
      const dist: number | null = inRange ? (e.distanceCm as number) : null;
      const fill: number | null =
        inRange && typeof e.fillPercent === "number"
          ? Math.min(100, Math.max(0, e.fillPercent))
          : null;
      hud = {
        ...base,
        distanceCm: dist,
        fillPercent: fill,
      };
      break;
    }
    default:
      hud = e.status ? { ...base, lastStatus: e.status } : base;
  }
  hudListeners.forEach((fn) => fn(hud));
}

// pipe every event through the derived HUD state
subscribeSimEvents(applyToHud);

export function getHudState(): StationHudState {
  return hud;
}

export function subscribeHud(fn: (s: StationHudState) => void): () => void {
  hudListeners.add(fn);
  fn(hud);
  return () => hudListeners.delete(fn);
}

/** Protocol version passthrough so fault frames stay conformant. */
export { PROTOCOL_VERSION };
