/**
 * Hardware simulator for MedWaste VerifyPoint development and demonstrations.
 *
 * Simulates an Arduino UNO + HC-05 station by emitting station events into the
 * application's event pipeline (the same events the real serial bridge would
 * forward from the device).
 *
 * Use this to:
 *   - Demonstrate the station console and event feed without hardware.
 *   - Test the command queue, acknowledgement, and gate state flow.
 *   - Run the app during development when no Arduino is connected.
 *
 * The simulator does NOT open a real serial port. For production, use the
 * hardware bridge (src/hardware/bridge/) with the real Arduino firmware.
 */

import { StationEvent, StationCommand } from "@/types";
import { dataStore } from "@/lib/data-store";

export interface SimulatorOptions {
  stationId?: string;
  tickIntervalMs?: number;
}

export class StationSimulator {
  private stationId: string;
  private tickIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(event: StationEvent) => void> = [];

  // Mutable simulation state (prefixed to avoid any collision with getters)
  private _irDetected = false;
  private _ultrasonicCm = 24;
  private _servoAngle = 90;
  private _lcdText = "Station ready";
  private _ledColour = "green";
  private _gateOpen = false;

  constructor(options: SimulatorOptions = {}) {
    this.stationId = options.stationId ?? "sim-station";
    this.tickIntervalMs = options.tickIntervalMs ?? 1800;
  }

  start(): void {
    if (this.intervalId !== null) return;
    const existing = dataStore.getStation(this.stationId);
    if (!existing) {
      // updateStation cannot create a record; the simulator must register the
      // station explicitly before its heartbeat can be applied.
      dataStore.ensureStation({
        id: this.stationId,
        name: "Simulation Station",
        locationId: "loc-1",
        serialNumber: "MW-SIM-001",
        online: true,
        lastHeartbeat: new Date(),
        gateState: "closed",
        createdAt: new Date(),
      });
    }
    dataStore.updateStation(this.stationId, { online: true, lastHeartbeat: new Date() });

    this.intervalId = setInterval(() => {
      this._irDetected = Math.random() > 0.78;
      this._ultrasonicCm = Math.max(2, Math.min(120, Math.round(this._ultrasonicCm + (Math.random() - 0.5) * 4)));
      this.emitIr();
      this.emitUltrasonic();
      this.emitHeartbeat();
    }, this.tickIntervalMs);

    this.emitHeartbeat();
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onEvent(listener: (event: StationEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: Omit<StationEvent, "stationId" | "receivedAt">): void {
    const full: StationEvent = {
      ...event,
      stationId: this.stationId,
      receivedAt: new Date(),
    };
    dataStore.pushStationEvent(full);
    this.listeners.forEach((l) => l(full));
  }

  private emitIr(): void {
    this.emit({ type: "sensor_ir", payload: { detected: this._irDetected } });
  }

  private emitUltrasonic(): void {
    this.emit({ type: "sensor_ultrasonic", payload: { distanceCm: this._ultrasonicCm } });
  }

  private emitHeartbeat(): void {
    this.emit({ type: "heartbeat", payload: { status: "ok" } });
    dataStore.updateStation(this.stationId, { lastHeartbeat: new Date(), online: true });
  }

  // Command handling — mirrors the firmware protocol semantics.
  handleCommand(command: StationCommand): void {
    switch (command.type) {
      case "open_gate": {
        this._gateOpen = true;
        dataStore.updateStation(this.stationId, { gateState: "open" });
        this.emit({ type: "gate_state", payload: { state: "open" } });
        this.emit({ type: "servo_position", payload: { position: 30 } });
        this.setLed("green");
        this.setLcd("Gate Open");
        break;
      }
      case "close_gate": {
        this._gateOpen = false;
        dataStore.updateStation(this.stationId, { gateState: "closed" });
        this.emit({ type: "gate_state", payload: { state: "closed" } });
        this.emit({ type: "servo_position", payload: { position: this._servoAngle } });
        this.setLed("amber");
        this.setLcd("Gate Closed");
        break;
      }
      case "set_servo": {
        const angle = Number((command.payload as any)?.position ?? 90);
        this._servoAngle = Math.max(0, Math.min(180, angle));
        this.emit({ type: "servo_position", payload: { position: this._servoAngle } });
        break;
      }
      case "lcd_display": {
        const text = String((command.payload as any)?.text ?? "Station ready");
        this._lcdText = text;
        this.emit({ type: "lcd_message", payload: { text } });
        break;
      }
      case "status_led": {
        const colour = String((command.payload as any)?.colour ?? "green");
        this._ledColour = colour;
        this.emit({ type: "status_led", payload: { colour } });
        break;
      }
      case "beep": {
        const ms = Number((command.payload as any)?.durationMs ?? 300);
        this.emit({ type: "beep", payload: { durationMs: ms } });
        break;
      }
      default:
        this.emit({ type: "bt_message", payload: { command: command.type } });
    }
  }

  // State getters for the UI
  get gateOpen(): boolean { return this._gateOpen; }
  get servoAngle(): number { return this._servoAngle; }
  get lcdText(): string { return this._lcdText; }
  get ledColour(): string { return this._ledColour; }
  get irDetected(): boolean { return this._irDetected; }
  get ultrasonicCm(): number { return this._ultrasonicCm; }

  // Command methods (called by handleCommand)
  private setLed(colour: string): void {
    this._ledColour = colour;
  }

  private setLcd(text: string): void {
    this._lcdText = text;
  }
}

// Small demo runner that can be started from a script or imported by a dev helper.
export function startSimulator(options: SimulatorOptions = {}) {
  const sim = new StationSimulator(options);
  sim.onEvent((event) => {
    // In the app, the station page reads events from dataStore directly,
    // so we just push them there; the listener here is for any additional wiring.
  });
  sim.start();
  return sim;
}
