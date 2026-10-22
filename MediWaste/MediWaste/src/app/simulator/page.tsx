"use client"
import { dataStore } from "@/lib/data-store";
import { StationEventSchema } from "@/types";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import {
  Radio,
  DoorOpen,
  DoorClosed,
  MousePointer,
  Type,
  Bell,
  ChevronRight,
  Activity,
  Clock,
  Wifi,
  WifiOff,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { SimBadge } from "@/components/sim/sim-badge";
import { emitSimEvent } from "@/lib/sim/store";
import { processStationRequest, MemoryRequestAdapter } from "@/lib/station/process-request";
import type { RequestAdapter } from "@/lib/station/process-request";
import { PROTOCOL_VERSION, type RequestStatus, type StationOperation, type BleRequestFrame } from "@/lib/station/protocol";

const SIM_STATION_ID = "sim-station";

export default function SimulatorPage() {
  const [gateOpen, setDoorOpen] = useState(false);
  const [servoPos, setServoPos] = useState(90);
  const [lcdText, setLcdText] = useState("Station ready");
  const [ledColour, setLedColour] = useState("green");
  const [irDetected, setIrDetected] = useState(false);
  const [ultrasonicCm, setUltrasonicCm] = useState(24);
  const [keypadEntry, setKeypadEntry] = useState("");
  const [keypadKey, setKeypadKey] = useState("1");
  const [sessionPackages, setSessionPackages] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "info" | "warning" | "error" } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ensure the simulator station exists, then announce its presence through the
  // same event bus the live bridge uses. Everything is flagged simulated.
  useEffect(() => {
    dataStore.ensureStation({
      id: SIM_STATION_ID,
      name: "Simulation Station",
      locationId: "loc-1",
      serialNumber: "MW-SIM-001",
      online: true,
      lastHeartbeat: new Date(),
      gateState: "closed",
      createdAt: new Date(),
    });
    emitSimEvent({
      type: "STATION_CONNECT",
      simulated: true,
      stationId: SIM_STATION_ID,
      note: "Simulation station connected",
    });
    emitSimEvent({
      type: "BLE_CONNECTED",
      simulated: true,
      stationId: SIM_STATION_ID,
      note: "Simulated ESP32 BLE link established",
    });

    // Periodic ultrasonic telemetry, published through the same bus the HUD
    // and 3D stage subscribe to. IR is left to the explicit Simulate control so
    // the UI never claims a package is present on its own.
    const id = setInterval(() => {
      const cm = Math.round(5 + Math.random() * 50);
      const fillPercent = Math.round(Math.min(100, Math.max(0, ((22 - cm) / 20) * 100)));
      setUltrasonicCm(cm);
      pushEvent("sensor_ultrasonic", { distanceCm: cm });
      emitSimEvent({
        type: "ULTRASONIC_SAMPLE",
        simulated: true,
        stationId: SIM_STATION_ID,
        distanceCm: cm,
        fillPercent,
        note: `Simulated HC-SR04 sample: ${cm} cm`,
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  function pushEvent(type: string, payload: any) {
    dataStore.pushStationEvent({
      stationId: SIM_STATION_ID,
      type: type as any,
      payload,
      receivedAt: new Date(),
    });
  }

  function flash(message: string, type: "success" | "info" | "warning" | "error") {
    setFeedback({ message, type });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFeedback(null), 3500);
  }

  function toggleGate(open: boolean) {
    setDoorOpen(open);
    pushEvent("gate_state", { state: open ? "open" : "closed" });
    dataStore.updateStation(SIM_STATION_ID, { gateState: open ? "open" : "closed" });
    flash(`Gate ${open ? "opened" : "closed"}.`, open ? "success" : "info");
  }

  function setServo(pos: number) {
    // Moving the slider only updates the pending value; the event is published
    // when the operator presses Set, not on every drag sample.
    setServoPos(pos);
  }

  function applyServo() {
    pushEvent("servo_position", { position: servoPos });
    flash(`Servo set to ${servoPos}°.`, "info");
  }

  function setLcd(text: string) {
    const t = text.trim() || "Station ready";
    setLcdText(t);
    pushEvent("lcd_message", { text: t });
    flash(`LCD updated: "${t}".`, "info");
  }

  function setLed(colour: string) {
    setLedColour(colour);
    pushEvent("status_led", { colour });
    flash(`LED set to ${colour}.`, "info");
  }

  function beep(durationMs: number = 300) {
    pushEvent("beep", { durationMs });
    flash(`Beep (${durationMs}ms).`, "info");
  }

  function simulateIr() {
    const detected = Math.random() > 0.45;
    setIrDetected(detected);
    pushEvent("sensor_ir", { detected });
    emitSimEvent({
      type: detected ? "IR_PLACED" : "IR_REMOVED",
      simulated: true,
      stationId: SIM_STATION_ID,
      note: detected ? "Simulated IR edge: package placed" : "Simulated IR edge: package removed",
    });
    flash(detected ? "IR: object detected." : "IR: no object.", detected ? "warning" : "info");
  }

  function simulateUltrasonic() {
    const dist = Math.round(5 + Math.random() * 50);
    setUltrasonicCm(dist);
    pushEvent("sensor_ultrasonic", { distanceCm: dist });
    const fillPercent = Math.round(Math.min(100, Math.max(0, ((22 - dist) / 20) * 100)));
    emitSimEvent({
      type: "ULTRASONIC_SAMPLE",
      simulated: true,
      stationId: SIM_STATION_ID,
      distanceCm: dist,
      fillPercent,
      note: `Simulated HC-SR04 sample: ${dist} cm`,
    });
    flash(`Ultrasonic: ${dist} cm (${fillPercent}% capacity).`, "info");
  }

  function simulateHeartbeat() {
    pushEvent("heartbeat", { status: "ok" });
    dataStore.updateStation(SIM_STATION_ID, { lastHeartbeat: new Date(), online: true });
    flash("Heartbeat sent.", "success");
  }

  function registerDemoPackage() {
    // Retry on the (unlikely) collision instead of throwing into the render tree.
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `MW-${Date.now().toString(36).toUpperCase().slice(-8)}${Math.random()
        .toString(36)
        .slice(2, 4)
        .toUpperCase()}`;
      if (!dataStore.getDonation(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      flash("Could not allocate a unique package code. Try again.", "error");
      return;
    }
    const donationCode = code;
    const donation = dataStore.createDonation({
      code: donationCode,
      packageInfo: {
        description: "Demo package (simulator)",
        form: "Tablet",
        strength: "500mg",
        manufacturer: "Fictional Pharma Co",
        batchNumber: `SIM-${Math.floor(1000 + Math.random() * 9000)}`,
        quantity: 30,
        unit: "tablets",
      },
      donorInfo: { name: "Simulator Intake", contact: "sim@example.org" },
      intakeLocationId: "loc-1",
      intakeStaffUid: "simulator",
    });
    setSessionPackages((prev) => [...prev, donation.code]);
    pushEvent("keypad", { action: "register", code: donation.code });
    flash(`Registered demo package ${donation.code}.`, "success");
  }

  const events = dataStore.listStationEvents(SIM_STATION_ID, 200);

  return (
    <>
      <PageHeading
        title="Simulator"
        description="Functional hardware simulator for development and demonstrations."
        actions={
          <div className="flex items-center gap-2">
            <SimBadge />
            <Button variant="outline" className="gap-1.5" onClick={simulateHeartbeat}>
              <Activity className="h-4 w-4" /> Heartbeat
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Live station console */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-medical-700" />
                  <CardTitle className="text-base">Live station console</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${gateOpen ? "bg-green-500" : "bg-slate-300"}`} />
                  <span className="text-xs text-slate-500">{gateOpen ? "Gate open" : "Gate closed"}</span>
                </div>
              </div>
              <CardDescription>
                This simulates an Arduino UNO station with HC-05 Bluetooth, IR sensor, ultrasonic sensor,
                LCD, keypad, status LED, and micro servo gate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Gate */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    {gateOpen ? <DoorOpen className="h-5 w-5" /> : <DoorClosed className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Acceptance gate</p>
                    <p className="text-xs text-slate-500">
                      {gateOpen
                        ? "Open — accepting packages"
                        : "Closed — not accepting packages"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleGate(true)}>
                    <DoorOpen className="h-3.5 w-3.5" /> Open
                  </Button>
                  <Button size="sm" onClick={() => toggleGate(false)}>
                    <DoorClosed className="h-3.5 w-3.5" /> Close
                  </Button>
                </div>
              </div>

              {/* Sensors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">IR sensor</div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <div className={`h-2 w-2 rounded-full ${irDetected ? "bg-red-500" : "bg-slate-300"}`} />
                    <span className="font-medium text-slate-900">{irDetected ? "Object detected" : "No object"}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="mt-2 w-full gap-1" onClick={simulateIr}>
                    <MousePointer className="h-3 w-3" /> Simulate
                  </Button>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Ultrasonic sensor</div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium text-slate-900">{ultrasonicCm} cm</span>
                  </div>
                  <Button size="sm" variant="ghost" className="mt-2 w-full gap-1" onClick={simulateUltrasonic}>
                    <Type className="h-3 w-3" /> Measure
                  </Button>
                </div>
              </div>

              {/* LCD preview */}
              <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-center">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">LCD display</div>
                <p className="mt-2 text-sm font-mono text-green-400 break-all">{lcdText}</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={lcdText}
                  onChange={(e) => setLcdText(e.target.value)}
                  placeholder="Message for LCD"
                  className="flex-1 font-mono text-sm"
                />
                <Button size="sm" onClick={() => setLcd(lcdText)}>Send</Button>
              </div>

              {/* Keypad entry */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-xs text-slate-500">Keypad entry</p>
                  <p className="text-sm font-medium text-slate-900">{keypadEntry || "—"}</p>
                </div>
                <div className="flex gap-1">
                  <Select
                    value={keypadKey}
                    onChange={(e) => setKeypadKey(e.target.value)}
                    className="w-40"
                  >
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "C", "OK"].map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => {
                    if (keypadKey === "C") {
                      setKeypadEntry("");
                      pushEvent("keypad", { action: "clear" });
                      flash("Keypad cleared.", "info");
                    } else if (keypadKey === "OK") {
                      if (!keypadEntry) {
                        flash("Enter a code on the keypad first.", "warning");
                        return;
                      }
                      pushEvent("keypad", { action: "submit", code: keypadEntry });
                      flash(`Keypad submitted: ${keypadEntry}.`, "success");
                    } else {
                      setKeypadEntry((prev) => prev + keypadKey);
                    }
                  }}>
                    Enter
                  </Button>
                </div>
              </div>

              {/* Servo */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-xs text-slate-500">Micro servo (gate)</p>
                  <p className="text-sm font-medium text-slate-900">{servoPos}°</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="range" min="0" max="180" value={servoPos} onChange={(e) => setServo(Number(e.target.value))} className="w-24" />
                  <Button size="sm" onClick={applyServo}>Set</Button>
                </div>
              </div>

              {/* Status LED */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-xs text-slate-500">Status LED</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${ledColour === "green" ? "bg-green-500" : ledColour === "amber" ? "bg-amber-500" : ledColour === "red" ? "bg-red-500" : "bg-slate-300"}`} />
                    <span className="text-sm text-slate-700">{ledColour}</span>
                  </div>
                </div>
                <Select value={ledColour} onChange={(e) => setLed(e.target.value)} className="w-36">
                  <option value="green">Green</option>
                  <option value="amber">Amber</option>
                  <option value="red">Red</option>
                  <option value="off">Off</option>
                </Select>
              </div>

              {/* Beep */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-xs text-slate-500">Buzzer</p>
                  <p className="text-sm text-slate-700">Ready</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => beep(300)}>
                  <Bell className="h-3.5 w-3.5" /> Beep 300ms
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Demo package registration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-medical-700" />
                Demo intake
              </CardTitle>
              <CardDescription>
                Register a fictional demo package so you can follow it through the rest of the app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button className="gap-1.5" onClick={registerDemoPackage}>
                  <ChevronRight className="h-4 w-4" /> Register demo package
                </Button>
                <span className="text-xs text-slate-500">
                  {sessionPackages.length} registered this session
                </span>
              </div>
              {sessionPackages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {sessionPackages.slice(-6).map((code) => (
                    <Badge key={code} variant="secondary" className="font-mono text-xs">
                      {code}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {/* Request lifecycle simulation (protocol v1) */}
          <RequestLifecycleSim />
        </div>

        {/* Right column: event log */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-medical-700" />
                  <CardTitle className="text-base">Event log</CardTitle>
                </div>
                <Badge variant="secondary">{events.length}</Badge>
              </div>
              <CardDescription>
                Simulated station events emitted in this session.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {events.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No events yet"
                  description="Interact with the simulator above to generate events."
                />
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <Table className="border-0">
                    <TableHeader className="bg-transparent sticky top-0">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-left text-xs text-slate-500">Time</TableHead>
                        <TableHead className="text-left text-xs text-slate-500">Event</TableHead>
                        <TableHead className="text-left text-xs text-slate-500">Payload</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.slice(0, 60).map((ev, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-slate-500 font-mono">
                            {new Date(ev.receivedAt as any).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {ev.type.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 font-mono max-w-[200px] truncate">
                            {JSON.stringify(ev.payload).slice(0, 80)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900 mb-1">Simulator notes</p>
              <p>
                Events emitted by the simulator are recorded in the same event store used by the station
                console. This lets you preview how real hardware events would appear in the application.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                The simulator does not require physical hardware. The real bridge communicates with the
                Arduino over serial/HC-05 when the hardware is connected.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {feedback && (
        <div className={`fixed bottom-6 right-6 rounded-lg px-4 py-2 text-sm shadow-lg ${
          feedback.type === "success" ? "bg-green-600 text-white" :
          feedback.type === "warning" ? "bg-amber-600 text-white" :
          feedback.type === "error" ? "bg-red-600 text-white" : "bg-slate-800 text-white"
        }`}>
          {feedback.message}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Request lifecycle simulation — runs the same evaluateTransition engine that
// the deployed Cloud Function and the ESP32 firmware flow use (protocol v1).
// Clearly labelled simulated results. Gate rule mirrors the firmware: only
// REQUEST_ACCEPTED would open a real gate.
// ---------------------------------------------------------------------------
const LIFECYCLE_ADAPTER = new MemoryRequestAdapter();

interface LifecycleResult {
  scenario: string;
  status: RequestStatus | "TRANSPORT_DOWN";
  expected: RequestStatus | "TRANSPORT_DOWN";
  pass: boolean;
  detail: string;
  at: number;
}

function RequestLifecycleSim() {
  const [results, setResults] = useState<LifecycleResult[]>([]);
  const [progress, setProgress] = useState("");
  const [simBusy, setSimBusy] = useState(false);

  // Seed a simulated record whose lifecycle mirrors the real state machine.
  useEffect(() => {
    LIFECYCLE_ADAPTER.upsert({ id: "sim-don-1", code: "MW-SIMDEMO1", status: "awaiting_inspection" });
  }, []);

  function record(r: Omit<LifecycleResult, "at" | "pass">) {
    setResults((prev) => [{ ...r, pass: r.status === r.expected, at: Date.now() }, ...prev].slice(0, 40));
  }

  function makeFrame(donationId: string, operation: StationOperation): BleRequestFrame {
    return {
      v: PROTOCOL_VERSION,
      msgId: `sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      stationId: "sim-station",
      operation,
      donationId,
    };
  }

  async function runScenario(kind: string) {
    setSimBusy(true);
    setProgress(kind);
    // Every scenario starts from the same known state, otherwise a previous
    // run changes the record and the expected result no longer applies.
    LIFECYCLE_ADAPTER.upsert({ id: "sim-don-1", code: "MW-SIMDEMO1", status: "awaiting_inspection" });
    try {
      if (kind === "valid_transition") {
        const resp = await processStationRequest(makeFrame("MW-SIMDEMO1", "inspection_started"), LIFECYCLE_ADAPTER);
        record({ scenario: "Valid transition", status: resp.status, expected: "REQUEST_ACCEPTED", detail: `now ${resp.currentStatus ?? "?"}` });
      } else if (kind === "unknown_id") {
        const resp = await processStationRequest(makeFrame("MW-DOESNOTEXIST", "inspection_started"), LIFECYCLE_ADAPTER);
        record({ scenario: "Unknown ID", status: resp.status, expected: "UNKNOWN_ID", detail: resp.detail ?? "" });
      } else if (kind === "illegal_state") {
        const resp = await processStationRequest(makeFrame("MW-SIMDEMO1", "inspection_completed"), LIFECYCLE_ADAPTER);
        record({ scenario: "Illegal transition (gate stays closed)", status: resp.status, expected: "NOT_ELIGIBLE_FOR_NEXT_STAGE", detail: resp.detail ?? "" });
      } else if (kind === "duplicate") {
        const frame = makeFrame("MW-SIMDEMO1", "inspection_started");
        const first = await processStationRequest(frame, LIFECYCLE_ADAPTER);
        const resp = await processStationRequest(frame, LIFECYCLE_ADAPTER);
        record({
          scenario: "Duplicate msgId",
          status: resp.status,
          expected: "ALREADY_PROCESSED",
          detail:
            first.status === "REQUEST_ACCEPTED"
              ? resp.detail ?? ""
              : `first delivery was ${first.status}, so dedupe could not be exercised`,
        });
      } else if (kind === "backend_delay") {
        const base = LIFECYCLE_ADAPTER;
        const slowAdapter: RequestAdapter = {
          getDonation: async (id) => {
            await new Promise((r) => setTimeout(r, 1200));
            return base.getDonation(id);
          },
          isDuplicate: (msgId, donationId) => base.isDuplicate(msgId, donationId),
          applyTransition: (p) => base.applyTransition(p),
          isAuthorisedFor: (uid, op) => base.isAuthorisedFor(uid, op),
        };
        const resp = await processStationRequest(makeFrame("MW-SIMDEMO1", "intake_registered"), slowAdapter);
        record({ scenario: "Backend delay 1.2s", status: resp.status, expected: "REQUEST_ACCEPTED", detail: "response applied after delay" });
      } else if (kind === "backend_failure") {
        const base = LIFECYCLE_ADAPTER;
        const brokenAdapter: RequestAdapter = {
          getDonation: async () => { throw new Error("firestore unavailable (simulated)"); },
          isDuplicate: (msgId, donationId) => base.isDuplicate(msgId, donationId),
          applyTransition: (p) => base.applyTransition(p),
          isAuthorisedFor: (uid, op) => base.isAuthorisedFor(uid, op),
        };
        const resp = await processStationRequest(makeFrame("MW-SIMDEMO1", "inspection_started"), brokenAdapter);
        record({ scenario: "Backend failure", status: resp.status, expected: "SERVER_ERROR", detail: resp.detail ?? "" });
      } else if (kind === "transport_down") {
        // Wi-Fi down at the device: the frame never leaves the ESP32.
        record({ scenario: "Wi-Fi disconnected (transport)", status: "TRANSPORT_DOWN", expected: "TRANSPORT_DOWN", detail: "frame queued, gate stays closed" });
      }
    } finally {
      setSimBusy(false);
      setProgress("");
    }
  }

  const scenarioButtons: Array<[string, string]> = [
    ["valid_transition", "Valid transition"],
    ["unknown_id", "Unknown ID"],
    ["illegal_state", "Illegal state"],
    ["duplicate", "Duplicate msgId"],
    ["backend_delay", "Backend delay"],
    ["backend_failure", "Backend failure"],
    ["transport_down", "Wi-Fi down"],
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-medical-700" />
            <CardTitle className="text-base">Request lifecycle tests (protocol v1)</CardTitle>
          </div>
          {progress && <Badge variant="secondary" className="animate-pulse">{progress}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription>
          Runs each scenario through the identical rule engine used by the real
          backend and firmware. Expected: ACCEPTED, UNKNOWN_ID, NOT_ELIGIBLE,
          ALREADY_PROCESSED, ACCEPTED, SERVER_ERROR, TRANSPORT_DOWN. Only
          REQUEST_ACCEPTED opens the gate.
        </CardDescription>
        <div className="flex flex-wrap gap-2">
          {scenarioButtons.map(([id, label]) => (
            <Button key={id} size="sm" variant="outline" disabled={simBusy} onClick={() => runScenario(id)}>
              {label}
            </Button>
          ))}
        </div>
        {results.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {results.map((r, i) => (
              <div key={`${r.at}-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs">
                <Badge variant={r.pass ? "success" : "destructive"} className="text-[10px] shrink-0">
                  {r.status}
                </Badge>
                <span className="font-medium text-slate-900 shrink-0">{r.scenario}</span>
                <span className="text-slate-500 truncate">
                  {r.pass ? "matched expected result" : `expected ${r.expected}`}
                  {r.detail ? ` — ${r.detail}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
