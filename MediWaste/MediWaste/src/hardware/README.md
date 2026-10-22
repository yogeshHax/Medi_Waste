# Hardware

This module contains the physical-station software: firmware, bridge, and simulator.

## Components

- `firmware/esp32/VerifyPointESP32.ino` — **ESP32 firmware** (active target): BLE + Wi-Fi + 16-pin parallel LCD + sensors + servo gate.
- `firmware/esp32/README.md` — exact pin map, flashing and provisioning.
- `protocol.md` — station protocol v1 (frames, status codes, transition table).
- `firmware/VerifyPoint.ino` — legacy Arduino UNO/HC-05 skeleton, superseded.
- `bridge/index.ts` — Node.js serial bridge (legacy path, kept for reference).
- `simulator/index.ts` — hardware simulator used by the `/simulator` page.

## Architecture

```
PHONE (BLE, Web Bluetooth) --BLE--> ESP32 --HTTPS (verified TLS, station token)--> BACKEND (functions/) --> FIRESTORE
                                  <--response-- 
```

The backend (`functions/src/index.ts`) is the only component that applies
protected state transitions and records the duplicate-request ledger; ingest
details in `docs/deploy-firebase.md`.

## Safety

- Gate default is CLOSED; only backend status `REQUEST_ACCEPTED` opens it.
- Sensor readings and phone messages never authorise acceptance.
- Invalid sensor readings surface as `unavail`, never fabricated values.
- This is not a certified pharmaceutical authentication device.

## Running the simulator

Open http://localhost:3000/simulator — includes sensor/command simulation and
request-lifecycle tests (valid/unknown/duplicate/delay/failure/Wi-Fi-down)
through the same rule engine as the deployed backend. Protocol engine unit
tests: `npm run test:protocol`.

## Phone -> station link

`/station/ble` is the Web Bluetooth companion: scan for **VerifyPoint**, connect
(service 0xffe0), subscribe to notifications (0xffe1), write request frames
(0xffe2). Chrome/Edge/Android Chrome only — not iOS Safari.

## Running the simulator

The station simulator runs inside the web app at http://localhost:3000/simulator —
start the dev server and open that page. It pushes events into the same store the rest
of the app reads from.

For scripted use, import `src/hardware/simulator/index.ts` and call `startSimulator()`.
This module uses the `@/` path alias, so it must run through the Next.js toolchain (or a
TypeScript runner that honours `tsconfig.json` paths) — it is not a plain `node` entry point.

## Running the bridge (production)

The bridge is a Node process that opens the serial/Bluetooth connection to the Arduino,
sends commands from the station command queue, and receives events. Configure the port,
baud rate, and Bluetooth address via environment variables or options.
