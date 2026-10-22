# ESP32 firmware — VerifyPoint (BLE protocol v1)

Firmware: [`esp32/VerifyPointESP32.ino`](esp32/VerifyPointESP32.ino).
BLE protocol: [`firmware/protocol.md`](../protocol.md).
The firmware stores **no secrets in source** — Wi-Fi SSID/password, station ID and
station token are provisioned over USB serial and kept in NVS flash.

## Safety principles (enforced in code)

- Gate default **CLOSED**; only backend status `REQUEST_ACCEPTED` opens it; gate
  auto-recloses after 5 s.
- Phone messages, sensor readings and the reset button can never open the gate
  or bypass backend validation.
- Commanded gate movement is reported as *commanded*, never as *confirmed* —
  no gate position sensor is fitted.
- Sensor failures are marked `unavail`, never replaced with plausible values.
- TLS certificate verification is always on once `certs/gts_root_r4.h` exists;
  builds without it print a permanent warning and must not be shipped.

## Exact pin map (do not deviate)

| Peripheral | Connection | ESP32 pin |
|---|---|---|
| IR presence sensor | OUT | GPIO 27 (3.3 V logic; never feed 5 V) |
| HC-SR04 | TRIG | GPIO 4 |
| HC-SR04 | ECHO | GPIO 18 **through a voltage divider / level shifter** |
| LCD RS | pin 4 | GPIO 13 |
| LCD E | pin 6 | GPIO 14 |
| LCD D4 | pin 11 | GPIO 16 |
| LCD D5 | pin 12 | GPIO 17 |
| LCD D6 | pin 13 | GPIO 21 |
| LCD D7 | pin 14 | GPIO 22 |
| LCD RW (pin 5) | — | GND |
| LCD VSS (1) / K (16) | — | GND |
| LCD VDD (2), A (15) | — | 5 V rail (A via resistor if the module needs one) |
| LCD VO (3) | — | 10 kΩ contrast pot wiper |
| Servo | signal | GPIO 19 (separate supply, common ground — never the ESP32 3V3 pin) |
| Green LED | anode | GPIO 25 via 220–330 Ω |
| Red LED | anode | GPIO 26 via 220–330 Ω |
| Reset button | — | GPIO 33 + GND (INPUT_PULLUP) |

## Flashing

1. Arduino IDE → Board: **ESP32 Dev Module**.
2. Install from Library Manager: **ESP32Servo**, **ArduinoJson** (v7).
   `LiquidCrystal`, `WiFi`, `WiFiClientSecure`, `BLE`, `Preferences` ship with
   the arduino-esp32 core.
3. For trustworthy TLS, save the Google Trust Services root CA (GTS Root R4) as
   `src/hardware/firmware/esp32/certs/gts_root_r4.h` containing:
   `const char ROOT_CA_PEM[] PROGMEM = R"pem(-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----)pem";`
   Without it, the build is a demo build with TLS verification disabled.
4. Set `BACKEND_URL` (build flag or edit) to your deployed
   `stationHttpRequest` URL — see `docs/deploy-firebase.md`.
5. Upload, open Serial Monitor at **115200 baud**.

## Provisioning (USB serial)

First boot waits for configuration over the serial monitor:

```
SET ID station-1
SET SSID YourWifi
SET PASS YourWifiPassword
SET TOKEN <station provisioning token — created by an admin, see below>
SAVE
```

The token is the per-station bearer credential for the backend (stored in
Firestore `medwaste_stations/{stationId}.provisioningToken`, cleared from the
chat/console once saved). `SHOW` prints config, `WIPE` resets NVS.

## Status LCD — what each screen means

| Line 1 | Meaning |
|---|---|
| `Wi-Fi connecting` | joining the network |
| `Wi-Fi ok` | IP shown on line 2 |
| `waiting phone` | BLE advertising, no client |
| `phone connected` | central connected |
| `Check ID MW-…` | request being sent to backend |
| `ACCEPTED MW-…` | backend authorised the transition — gate opens 5 s |
| `UNKNOWN_ID` / `REQUIRES_REVIEW` / `ALREADY_PROCESSED` / `NOT_ELIGIBLE…` | backend refused; gate stays closed |
| `NETWORK_ERROR` / `backend error` | transport failed; gate stays closed |
| `Wi-Fi FAILED will retry` | reconnect loop active |

## Notes & limitations

- HC-SR04 measurement uses median-of-3 with a hard timeout; out-of-range or
  timeout readings surface as `unavail` rather than a fabricated distance.
- Without a gate position sensor the firmware reports the *commanded* state
  only; fitting a limit/microswitch would allow real confirmation.
- The reset button (GPIO 33) re-establishes Wi-Fi + BLE only. It never changes
  the gate state or skips backend checks.
- BLE library is the Bluedroid (`BLEDevice.h`) stack included with the ESP32
  core; a phone scans for the device name **VerifyPoint** with service UUID
  `0000ffe0-…`, writes request frames to `ffe2`, and subscribes for
  notifications on `ffe1`.
