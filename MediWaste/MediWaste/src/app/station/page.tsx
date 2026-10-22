"use client"
import { dataStore } from "@/lib/data-store";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import {
  Radio,
  Wifi,
  WifiOff,
  DoorClosed,
  DoorOpen,
  ChevronRight,
  Activity,
  Gauge,
  Thermometer,
  Bell,
  MousePointer,
  History,
  Send,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getHudState, subscribeHud, emitSimEvent, type StationHudState } from "@/lib/sim/store";
import { SimBadge } from "@/components/sim/sim-badge";
import { useDataStoreVersion } from "@/lib/use-data-store";

export default function StationPage() {
  // Subscribe so gate state, command history and the event feed refresh after
  // a command is queued or acknowledged.
  useDataStoreVersion();
  const stations = dataStore.listStations();
  const events = dataStore.listStationEvents(undefined, 100);
  const [selectedStationId, setSelectedStationId] = useState(stations[0]?.id ?? "");
  const selectedStation = selectedStationId ? dataStore.getStation(selectedStationId) : undefined;

  return (
    <>
      <PageHeading
        title="Station"
        description="Connected station status, sensor readings, command history, and gate control."
      />

      {/* Station selector */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-900">Select station</span>
            </div>
            <Select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-56"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.serialNumber ? `· ${s.serialNumber}` : ""}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Station status + controls */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Live status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Radio className="h-4 w-4 text-medical-700" />
                  Live status
                </CardTitle>
                {selectedStation && (
                  <Badge variant={selectedStation.online ? "success" : "secondary"}>
                    {selectedStation.online ? "Online" : "Offline"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedStation ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Gate state</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">
                        {selectedStation.gateState === "open" ? "OPEN" : "CLOSED"}
                      </span>
                      <div
                        className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white ${
                          selectedStation.gateState === "open" ? "bg-green-600" : "bg-slate-400"
                        }`}
                      >
                        {selectedStation.gateState === "open" ? (
                          <DoorOpen className="h-5 w-5" />
                        ) : (
                          <DoorClosed className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {selectedStation.gateState === "open"
                        ? "The acceptance gate is open. Packages may be accepted."
                        : "The acceptance gate is closed. Packages are not being accepted."}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Last heartbeat</div>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {selectedStation.lastHeartbeat
                        ? new Date(selectedStation.lastHeartbeat as any).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "—"}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Activity className="h-3.5 w-3.5" />
                      {selectedStation.online ? "Station is responding" : "Station has not responded recently"}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Radio}
                  title="No station selected"
                  description="Choose a station above to view its status."
                />
              )}
            </CardContent>
          </Card>

          {/* Sensor readings (simulated) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4 text-medical-700" />
                Sensor readings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedStation && (
                <SensorReadings stationId={selectedStation.id} />
              )}
            </CardContent>
          </Card>

          {/* Command history */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-medical-700" />
                  Command history
                </CardTitle>
                <Badge variant="secondary">{dataStore.listStationCommands(selectedStationId).length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="sm:p-0">
              {dataStore.listStationCommands(selectedStationId).length === 0 ? (
                <div className="p-4 text-sm text-slate-500">No commands sent yet.</div>
              ) : (
                <Table className="border-0">
                  <TableHeader className="bg-transparent">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-left text-xs text-slate-500">Command</TableHead>
                      <TableHead className="text-left text-xs text-slate-500">Status</TableHead>
                      <TableHead className="text-left text-xs text-slate-500">Sent</TableHead>
                      <TableHead className="text-left text-xs text-slate-500">Ack</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataStore.listStationCommands(selectedStationId).slice(0, 20).map((cmd) => (
                      <TableRow key={cmd.id}>
                        <TableCell className="font-medium text-slate-900 text-sm">{cmd.type.replace(/_/g, " ")}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              cmd.status === "acknowledged"
                                ? "success"
                                : cmd.status === "rejected"
                                ? "destructive"
                                : cmd.status === "timeout"
                                ? "warning"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {cmd.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {cmd.sentAt
                            ? new Date(cmd.sentAt as any).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {cmd.acknowledgedAt
                            ? new Date(cmd.acknowledgedAt as any).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Send commands */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-medical-700" />
                Send command
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedStation && (
                <>
                  <SendGateCommand stationId={selectedStation.id} />
                  <SendServoCommand stationId={selectedStation.id} />
                  <SendLcdCommand stationId={selectedStation.id} />
                  <SendLedCommand stationId={selectedStation.id} />
                  <SendBeepCommand stationId={selectedStation.id} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Connectivity info */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-sm text-slate-600">
              <div className="flex items-center gap-2 text-slate-900 font-medium mb-1">
                <Wifi className="h-4 w-4" />
                Connectivity
              </div>
              <p>
                Commands are queued locally and forwarded to the connected hardware bridge
                (Node.js serial / HC-05 Bluetooth) when a station is online.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                In the simulator, commands are applied immediately and reflected in sensor readings and events.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event feed */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MousePointer className="h-4 w-4 text-medical-700" />
            Recent events
          </CardTitle>
          <Badge variant="secondary">{events.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No events yet.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {events.slice(0, 40).map((ev, i) => (
                <div key={`${ev.stationId}-${ev.type}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {new Date(ev.receivedAt as any).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                  </span>
                  <span className="font-medium text-slate-900 text-xs uppercase tracking-wider">{ev.type.replace(/_/g, " ")}</span>
                  <span className="text-slate-500 text-xs truncate">
                    Station {ev.stationId} — {ev.type === "heartbeat" ? "heartbeat" : JSON.stringify(ev.payload).slice(0, 60)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// -------------------------------------------------------------------
// Sub-components for commands
// -------------------------------------------------------------------
function SendGateCommand({ stationId }: { stationId: string }) {
  const [open, setOpen] = useState(false);
  function send(nextOpen: boolean) {
    // Take the target state as an argument: reading `open` straight after
    // setOpen() returns the previous render's value and sent the opposite
    // command.
    setOpen(nextOpen);
    const state: "open" | "closed" = nextOpen ? "open" : "closed";
    const cmd = dataStore.queueCommand({
      stationId,
      type: nextOpen ? "open_gate" : "close_gate",
      payload: { state },
    });
    dataStore.updateStation(stationId, { gateState: state });
    dataStore.pushStationEvent({ stationId, type: "gate_state", payload: { state }, receivedAt: new Date() });
    dataStore.updateCommand(cmd.id, { status: "sent", sentAt: new Date() });
    // simulate acknowledgement after a short delay
    setTimeout(() => {
      dataStore.updateCommand(cmd.id, { status: "acknowledged", acknowledgedAt: new Date() });
    }, 300);
  }
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <p className="text-sm font-medium text-slate-900">Gate</p>
        <p className="text-xs text-slate-500">{open ? "Open" : "Closed"}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => send(true)}>
          <DoorOpen className="h-3.5 w-3.5" /> Open
        </Button>
        <Button size="sm" className="gap-1" onClick={() => send(false)}>
          <DoorClosed className="h-3.5 w-3.5" /> Close
        </Button>
      </div>
    </div>
  );
}

function SendServoCommand({ stationId }: { stationId: string }) {
  const [pos, setPos] = useState(90);
  function send() {
    const cmd = dataStore.queueCommand({ stationId, type: "set_servo", payload: { position: pos } });
    dataStore.pushStationEvent({ stationId, type: "servo_position", payload: { position: pos }, receivedAt: new Date() });
    dataStore.updateCommand(cmd.id, { status: "sent", sentAt: new Date() });
    setTimeout(() => {
      dataStore.updateCommand(cmd.id, { status: "acknowledged", acknowledgedAt: new Date() });
    }, 300);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-900">Servo position</span>
        <span className="text-slate-500">{pos}°</span>
      </div>
      <div className="flex items-center gap-2">
        <Input type="range" min="0" max="180" value={pos} onChange={(e) => setPos(Number(e.target.value))} className="flex-1" />
        <Button size="sm" onClick={send}>Set</Button>
      </div>
    </div>
  );
}

function SendLcdCommand({ stationId }: { stationId: string }) {
  const [text, setText] = useState("Station ready");
  function send() {
    const t = text.trim() || "Station ready";
    const cmd = dataStore.queueCommand({ stationId, type: "lcd_display", payload: { text: t } });
    dataStore.pushStationEvent({ stationId, type: "lcd_message", payload: { text: t }, receivedAt: new Date() });
    dataStore.updateCommand(cmd.id, { status: "sent", sentAt: new Date() });
    setTimeout(() => {
      dataStore.updateCommand(cmd.id, { status: "acknowledged", acknowledgedAt: new Date() });
    }, 300);
  }
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-900">LCD message</div>
      <div className="space-y-1.5">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message for the station LCD" className="text-sm" />
        <Button size="sm" className="w-full" onClick={send}>Send to LCD</Button>
      </div>
    </div>
  );
}

function SendLedCommand({ stationId }: { stationId: string }) {
  const [colour, setColour] = useState("green");
  function send() {
    const cmd = dataStore.queueCommand({ stationId, type: "status_led", payload: { colour } });
    dataStore.pushStationEvent({ stationId, type: "status_led", payload: { colour }, receivedAt: new Date() });
    dataStore.updateCommand(cmd.id, { status: "sent", sentAt: new Date() });
    setTimeout(() => {
      dataStore.updateCommand(cmd.id, { status: "acknowledged", acknowledgedAt: new Date() });
    }, 300);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-900">Status LED</span>
        <span className="text-slate-500">{colour}</span>
      </div>
      <Select value={colour} onChange={(e) => setColour(e.target.value)}>
        <option value="green">Green</option>
        <option value="amber">Amber</option>
        <option value="red">Red</option>
        <option value="off">Off</option>
      </Select>
      <Button size="sm" className="w-full" onClick={send}>Set LED</Button>
    </div>
  );
}

function SendBeepCommand({ stationId }: { stationId: string }) {
  function send() {
    const cmd = dataStore.queueCommand({ stationId, type: "beep", payload: { durationMs: 300 } });
    dataStore.pushStationEvent({ stationId, type: "beep", payload: { durationMs: 300 }, receivedAt: new Date() });
    dataStore.updateCommand(cmd.id, { status: "sent", sentAt: new Date() });
    setTimeout(() => {
      dataStore.updateCommand(cmd.id, { status: "acknowledged", acknowledgedAt: new Date() });
    }, 300);
  }
  return (
    <Button size="sm" className="w-full gap-1.5" variant="outline" onClick={send}>
      <Bell className="h-3.5 w-3.5" /> Beep (300ms)
    </Button>
  );
}

function SensorReadings({ stationId }: { stationId: string }) {
  const [hud, setHud] = useState<StationHudState>(() => getHudState());

  useEffect(() => subscribeHud(setHud), []);

  const readings: Record<string, string> = {
    ir: !hud.online ? "Station offline" : hud.irActive ? "Object detected" : "No object",
    ultrasonic: hud.distanceCm !== null ? `${hud.distanceCm.toFixed(1)} cm` : "— cm",
    // These channels are not present on the documented VerifyPoint pin map;
    // showing fabricated values here would misrepresent live telemetry.
    temperature: "Not instrumented",
    weight: "Not instrumented",
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Readings mirror the station/simulator telemetry stream; no synthetic values are generated.
        </p>
        {hud.online && hud.simulated && <SimBadge />}
      </div>
      {Object.entries(readings).map(([key, value]) => (
        <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500 capitalize">{key.replace(/_/g, " ")}</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
        </div>
      ))}
      <button
        type="button"
        className="col-span-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500 hover:border-medical-300 hover:text-medical-700 transition-colors"
        onClick={() => {
          dataStore.pushStationEvent({ stationId, type: "heartbeat", payload: { status: "ok" }, receivedAt: new Date() });
          dataStore.updateStation(stationId, { lastHeartbeat: new Date(), online: true });
          emitSimEvent({
            type: "STATION_CONNECT",
            simulated: true,
            stationId,
            note: "Heartbeat triggered from the station console (simulated)",
          });
        }}
      >
        Simulate heartbeat
      </button>
    </div>
  );
}
