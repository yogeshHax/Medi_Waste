"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// Minimal ambient types for Web Bluetooth (avoid pulling @types/web-bluetooth).
// Only the surface this page touches is declared.
// -----------------------------------------------------------------------------
interface BluetoothRemoteGATTCharacteristic {
  value?: DataView | null;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  writeValue(value: BufferSource): Promise<void>;
  addEventListener(
    type: "characteristicvaluechanged",
    listener: (event: Event) => void
  ): void;
}
interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: number | string): Promise<BluetoothRemoteGATTCharacteristic>;
}
interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(uuid: number | string): Promise<BluetoothRemoteGATTService>;
}
interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: "gattserverdisconnected", listener: () => void): void;
}
interface Bluetooth {
  requestDevice(options: {
    filters: Array<{ name?: string; services?: Array<number | string> }>;
    optionalServices?: Array<number | string>;
  }): Promise<BluetoothDevice>;
}
declare global {
  interface Navigator {
    readonly bluetooth?: Bluetooth;
  }
}
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Send,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  BleRequestFrameSchema,
  PROTOCOL_VERSION,
  RequestStatusSchema,
  statusHeadline,
  type RequestStatus,
} from "@/lib/station/protocol";

/**
 * Phone companion for the ESP32 station.
 * Uses Web Bluetooth (Chrome / Edge / Android Chrome — not iOS Safari).
 *
 * Guarantee shown in the UI: "delivered to device" (BLE ack) is always
 * distinguishable from "approved by backend" (status REQUEST_ACCEPTED).
 */

const SERVICE_UUID = 0xffe0;
const CHAR_NOTIFY_UUID = 0xffe1; // ESP32 -> phone
const CHAR_WRITE_UUID = 0xffe2;  // phone -> ESP32

const STATION_ID_DEFAULT = "station-1";

interface LogEntry {
  at: number;
  kind: "info" | "ack" | "response" | "error" | "sent";
  text: string;
  status?: RequestStatus;
}

type BleState =
  | "unsupported"
  | "disconnected"
  | "connecting"
  | "connected";

export default function BleStationPage() {
  // Never read `navigator` during render: SSR and client would disagree and
  // hydration fails. Start optimistic, correct it in an effect below.
  const [bleState, setBleState] = useState<BleState>("disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stationId, setStationId] = useState(STATION_ID_DEFAULT);
  const [operation, setOperation] = useState("inspection_started");
  const [donationId, setDonationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastStatus, setLastStatus] = useState<RequestStatus | null>(null);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const notifyCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const writeCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const pendingAckRef = useRef<Map<string, (ok: boolean) => void>>(new Map());

  useEffect(() => {
    if (typeof navigator !== "undefined" && !("bluetooth" in navigator)) {
      setBleState("unsupported");
    }
  }, []);

  const log = useCallback((kind: LogEntry["kind"], text: string, status?: RequestStatus) => {
    setLogs((prev) => [{ at: Date.now(), kind, text, status }, ...prev].slice(0, 60));
  }, []);

  // GATT notify listener: ack frames resolve the pending ack promise; response
  // frames update status. Malformed frames are logged and discarded.
  const onNotify = useCallback(
    (event: Event) => {
      const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
      const decoder = new TextDecoder();
      const raw = decoder.decode(target.value ?? new Uint8Array());
      try {
        const frame = JSON.parse(raw);
        if (frame.type === "ack") {
          const resolver = pendingAckRef.current.get(frame.echo);
          pendingAckRef.current.delete(frame.echo);
          resolver?.(true);
          log("ack", `Device acked ${frame.echo}`);
          return;
        }
        if (frame.type === "error") {
          const resolver = pendingAckRef.current.get(frame.echo ?? "");
          pendingAckRef.current.delete(frame.echo ?? "");
          resolver?.(false);
          log("error", `Device rejected frame (${frame.reason})`);
          return;
        }
        const status = RequestStatusSchema.safeParse(frame.status);
        if (status.success) {
          setLastStatus(status.data);
          log(
            "response",
            `Backend: ${status.data} — ${frame.detail ?? ""} ${
              frame.donationCode ? `(record ${frame.donationCode})` : ""
            }`,
            status.data
          );
          const resolver = pendingAckRef.current.get(frame.msgId);
          pendingAckRef.current.delete(frame.msgId);
          resolver?.(true);
          pendingResponseRef.current?.(frame.msgId ?? "");
        } else {
          log("error", "Malformed response frame discarded");
        }
      } catch {
        log("error", "Unparseable notification discarded");
      }
    },
    [log]
  );

  const disconnect = useCallback(async () => {
    try {
      await deviceRef.current?.gatt?.disconnect();
    } finally {
      deviceRef.current = null;
      notifyCharRef.current = null;
      writeCharRef.current = null;
      setBleState("disconnected");
      setLastStatus(null);
      log("info", "Disconnected.");
    }
  }, [log]);

  const connect = useCallback(async () => {
    if (!navigator.bluetooth) return;
    setBleState("connecting");
    log("info", "Requesting device — pick VerifyPoint when it appears.");
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "VerifyPoint" }],
        optionalServices: [SERVICE_UUID],
      });
      deviceRef.current = device;
      device.addEventListener("gattserverdisconnected", () => {
        setBleState("disconnected");
        setLastStatus(null);
        log("info", "Device disconnected.");
      });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      notifyCharRef.current = await service.getCharacteristic(CHAR_NOTIFY_UUID);
      await notifyCharRef.current.startNotifications();
      notifyCharRef.current.addEventListener("characteristicvaluechanged", onNotify);
      writeCharRef.current = await service.getCharacteristic(CHAR_WRITE_UUID);
      setBleState("connected");
      log("info", `Connected to ${device.name ?? "VerifyPoint"}.`);
    } catch (err) {
      setBleState("disconnected");
      log("error", `Connection failed: ${(err as Error).message}`);
    }
  }, [log, onNotify]);

  // Duplicate protection: a msgId already in-flight is not re-sent.
  const inFlightRef = useRef(false);

  const sendRequest = useCallback(async () => {
    const writeChar = writeCharRef.current;
    if (!writeChar || bleState !== "connected" || inFlightRef.current) return;

    const msgId = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const frame = BleRequestFrameSchema.safeParse({
      v: PROTOCOL_VERSION,
      msgId,
      stationId: stationId.trim() || STATION_ID_DEFAULT,
      operation,
      donationId: donationId.trim(),
      sentAt: Date.now(),
    });
    if (!frame.success) {
      log("error", "Request invalid — check station ID and donation ID.");
      return;
    }

    setBusy(true);
    inFlightRef.current = true;
    try {
      const payload = new TextEncoder().encode(JSON.stringify(frame.data));
      const acked = await Promise.race([
        new Promise<boolean>((resolve) => {
          pendingAckRef.current.set(msgId, resolve);
          writeChar.writeValue(payload).then(
            () => log("sent", `${operation} → ${donationId} (waiting ack)`),
            (err) => {
              pendingAckRef.current.delete(msgId);
              resolve(false);
              log("error", `Write failed: ${(err as Error).message}`);
            }
          );
        }),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
      ]);

      if (!acked) {
        pendingAckRef.current.delete(msgId);
        log("error", "No ack within 5 s — device may be asleep or out of range.");
        return;
      }

      // Wait for the backend response (arrives via notify) with a 15 s timeout.
      const responded = await Promise.race([
        new Promise<boolean>((resolve) => {
          pendingResponseRef.current = (id) => resolve(id === msgId);
        }),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 15000)),
      ]);
      pendingResponseRef.current = null;
      if (!responded) {
        log("error", "Backend response timed out. The request may still have been processed — do not retry blindly; send the same msgId later to dedupe.");
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, [bleState, donationId, log, operation, stationId]);

  // Response correlation: notify handler resolves the waiter by msgId.
  const pendingResponseRef = useRef<((id: string) => void) | null>(null);

  const statusBadge = useMemo(() => {
    if (!lastStatus) return null;
    const good = lastStatus === "REQUEST_ACCEPTED";
    return (
      <Badge variant={good ? "success" : "destructive"} className="gap-1.5">
        {good ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {lastStatus}
      </Badge>
    );
  }, [lastStatus]);

  if (bleState === "unsupported") {
    return (
      <>
        <PageHeading
          title="Station BLE link"
          description="Phone companion for the ESP32 station."
        />
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Web Bluetooth unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              This browser does not expose Web Bluetooth. Use Chrome on Android or
              Chrome/Edge on desktop with a BLE adapter. iOS Safari does not
              support Web Bluetooth.
            </p>
            <p className="text-xs text-slate-500">
              The station flow is still fully testable via the
              in-app simulator (same protocol, same statuses) at /simulator.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title="Station BLE link"
        description="Connect to the VerifyPoint ESP32, send a request, watch the backend decision."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bluetooth className="h-4 w-4 text-medical-700" />
              Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {bleState === "connected" ? (
                  <>
                    <BluetoothConnected className="h-4 w-4 text-green-600" />
                    <span className="text-green-700 font-medium">Connected</span>
                  </>
                ) : bleState === "connecting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    <span className="text-slate-500">Connecting…</span>
                  </>
                ) : (
                  <>
                    <BluetoothOff className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-500">Disconnected</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {bleState !== "connected" ? (
                  <Button size="sm" onClick={connect} disabled={bleState === "connecting"}>
                    Scan &amp; connect
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={disconnect}>
                    Disconnect
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stationId">Station ID</Label>
              <Input
                id="stationId"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                placeholder={STATION_ID_DEFAULT}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4 text-medical-700" />
                Send request
              </span>
              {statusBadge}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="operation">Operation</Label>
              <Select
                id="operation"
                value={operation}
                onChange={(e) => setOperation(e.target.value)}
              >
                <option value="intake_registered">intake_registered</option>
                <option value="inspection_started">inspection_started</option>
                <option value="inspection_completed">inspection_completed</option>
                <option value="review_decision">review_decision</option>
              </Select>
              <p className="text-xs text-slate-500">
                The station sends this transition request; the backend decides
                whether the record&apos;s current state permits it.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="donationId">Donation ID</Label>
              <Input
                id="donationId"
                value={donationId}
                onChange={(e) => setDonationId(e.target.value)}
                placeholder="MW-AB12CD34 or don-1"
              />
            </div>
            <Button
              className="w-full gap-1.5"
              disabled={busy || bleState !== "connected" || !donationId.trim()}
              onClick={sendRequest}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Waiting for backend…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Send request
                </>
              )}
            </Button>
            <p className="text-[11px] text-slate-500">
              Delivered ≠ approved. A message ack means the ESP32 got the frame;
              only backend status REQUEST_ACCEPTED authorises anything.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Protocol log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              Connect and send a request — protocol activity is logged here.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((l, i) => (
                <div key={`${l.at}-${i}`} className="flex items-start gap-3 px-4 py-2 text-sm">
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(l.at).toLocaleTimeString("en-GB")}
                  </span>
                  <span
                    className={`text-xs uppercase tracking-wider font-medium ${
                      l.kind === "error"
                        ? "text-red-600"
                        : l.kind === "response"
                        ? "text-medical-700"
                        : l.kind === "ack"
                        ? "text-green-600"
                        : "text-slate-500"
                    }`}
                  >
                    {l.kind}
                  </span>
                  <span className="text-slate-700 text-xs">{l.text}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
