/**
 * Hardware bridge — Node.js serial communication layer for the MedWaste station.
 *
 * Communicates with the Arduino UNO over serial (USB) or Bluetooth (HC-05).
 * In production, this runs as a small long-lived Node process that:
 *   - Opens the serial port (or Bluetooth RFCOMM channel).
 *   - Sends commands from the station command queue.
 *   - Receives sensor/state events from the device.
 *   - Forwards events into the application's event pipeline.
 *
 * For the emulator demo, the simulator page emits events directly. This bridge
 * is the production path and is not required to run the simulator.
 */

import { StationCommand, StationEvent } from "@/types";

export interface BridgeOptions {
  port?: string;            // e.g. COM3 on Windows, /dev/ttyUSB0 on Linux
  baudRate?: number;        // default 9600 for HC-05/Arduino
  bluetoothAddress?: string; // HC-05 MAC/BT address when using Bluetooth
  reconnectIntervalMs?: number;
  commandTimeoutMs?: number;
}

export interface Bridge {
  open(): Promise<void>;
  close(): Promise<void>;
  sendCommand(command: StationCommand): Promise<void>;
  onEvent(listener: (event: StationEvent) => void): void;
  isOpen(): boolean;
}

// ---------------------------------------------------------------------------
// Protocol (simple text-line protocol examples)
//
// Commands sent to device (one per line, terminated by \n):
//   OPEN_GATE
//   CLOSE_GATE
//   SET_SERVO <angle>
//   LCD <text>
//   LED <green|amber|red|off>
//   BEEP <ms>
//
// Events received from device (one per line):
//   HB                      -> heartbeat
//   IR 1                    -> IR object detected (1) / not (0)
//   US <cm>                 -> ultrasonic distance in cm
//   GATE <open|closed>      -> gate state change
//   SERVO <angle>           -> servo position report
//   LCD <text>              -> LCD content report
//   LED <colour>            -> status LED report
//
// This is a demonstration protocol; the real firmware would define the exact framing.
// ---------------------------------------------------------------------------

export class SerialBridge implements Bridge {
  private options: Required<BridgeOptions>;
  private listeners: Array<(event: StationEvent) => void> = [];
  private _open = false;

  constructor(options: BridgeOptions = {}) {
    this.options = {
      port: options.port ?? "",
      baudRate: options.baudRate ?? 9600,
      bluetoothAddress: options.bluetoothAddress ?? "",
      reconnectIntervalMs: options.reconnectIntervalMs ?? 5000,
      commandTimeoutMs: options.commandTimeoutMs ?? 8000,
    };
  }

  isOpen(): boolean {
    return this._open;
  }

  async open(): Promise<void> {
    // In production this opens a serial port via a library such as `serialport`.
    // For the emulator demo, this is a no-op placeholder.
    this._open = true;
  }

  async close(): Promise<void> {
    this._open = false;
    this.listeners = [];
  }

  async sendCommand(command: StationCommand): Promise<void> {
    if (!this._open) {
      throw new Error("Bridge is not open.");
    }
    // In production: write the command line to the serial port and await acknowledgement.
    // For the emulator demo, the simulator applies the command immediately.
    // Here we just acknowledge so the command queue can advance.
  }

  onEvent(listener: (event: StationEvent) => void): void {
    this.listeners.push(listener);
  }

  // Internal: called when a line is received from the device (production).
  // parseAndEmit(line: string): void {
  //   const parts = line.trim().split(/\s+/);
  //   const type = parts[0].toUpperCase();
  //   const payload = parts.slice(1);
  //   let event: StationEvent | null = null;
  //   switch (type) {
  //     case "HB": event = { stationId: "device", type: "heartbeat", payload: { status: "ok" }, receivedAt: new Date() }; break;
  //     case "IR": event = { stationId: "device", type: "sensor_ir", payload: { detected: parts[1] === "1" }, receivedAt: new Date() }; break;
  //     case "US": event = { stationId: "device", type: "sensor_ultrasonic", payload: { distanceCm: Number(parts[1]) }, receivedAt: new Date() }; break;
  //     // ... etc
  //   }
  //   if (event) this.listeners.forEach(l => l(event));
  // }
}

// ---------------------------------------------------------------------------
// Command queue processor (production: runs as part of the bridge process)
// ---------------------------------------------------------------------------
export async function processCommandQueue(
  bridge: Bridge,
  getCommands: () => StationCommand[],
  acknowledge: (id: string, status: StationCommand["status"], acknowledgedAt?: Date) => void,
  reject: (id: string, status: StationCommand["status"]) => void,
) {
  const commands = getCommands();
  for (const cmd of commands) {
    if (cmd.status !== "queued") continue;
    try {
      await bridge.sendCommand(cmd);
      acknowledge(cmd.id, "sent", new Date());
      // In production: await acknowledgement from device or timeout.
      // For demo: immediately mark acknowledged.
      acknowledge(cmd.id, "acknowledged", new Date());
    } catch (err) {
      reject(cmd.id, "rejected");
    }
  }
}
