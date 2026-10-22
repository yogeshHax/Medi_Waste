# Firmware — VerifyPoint.ino

Arduino UNO firmware for the MedWaste VerifyPoint verification station.

## What it does

- Reads IR and ultrasonic sensors.
- Reports sensor events (IR object detection, ultrasonic distance) to the bridge.
- Displays messages on the LCD.
- Accepts keypad input and forwards it.
- Controls a status LED (green/amber/red/off).
- Controls a micro servo gate actuator.
- Drives a buzzer for beep feedback.
- Sends periodic heartbeats when connected.
- Receives text-line commands from the Bluetooth/serial bridge and executes them.

## Safety-critical behaviour

- The default gate state is **CLOSED**.
- Sensor readings and device messages do **not** independently authorise acceptance.
- The gate is only moved when a valid, authorised command is received from the backend.
- This is an intake and review-support system, **not** a certified pharmaceutical
  authentication device.

## Hardware (typical)

- Arduino UNO
- HC-05 Bluetooth module
- IR sensor (digital output)
- Ultrasonic sensor (HC-SR04)
- 16x2 LCD (I2C or parallel)
- 4x4 membrane keypad
- Status LED (single colour or RGB)
- Passive buzzer
- Micro servo (gate actuator)

## Wiring

Adjust the pin constants in the firmware to match your actual wiring:

- `PIN_IR_SENSOR` — IR sensor digital out.
- `PIN_US_TRIG` / `PIN_US_ECHO` — ultrasonic sensor.
- `PIN_SERVO` — servo signal.
- `PIN_STATUS_LED_R/G/B` — status LED (adjust for your LED wiring).
- `PIN_BUZZER` — passive buzzer.
- LCD and keypad pins depend on your LCD/keypad library and wiring.

For HC-05, connect TX/RX to Arduino with appropriate voltage-level shifting.

## Protocol

Text-line, newline-terminated.

Commands sent to device:

- `OPEN_GATE`
- `CLOSE_GATE`
- `SET_SERVO <angle>`
- `LCD <text>`
- `LED <green|amber|red|off>`
- `BEEP <ms>`

Events received from device:

- `HB` — heartbeat
- `IR <0|1>` — IR object detected
- `US <cm>` — ultrasonic distance
- `GATE <open|closed>` — gate state change
- `SERVO <angle>` — servo position report
- `LCD <text>` — LCD content report
- `LED <colour>` — status LED report

## Calibration

- Adjust sensor thresholds and timeouts for your hardware.
- Add debouncing/filtering for noisy sensors.
- Define open/closed servo angles that match your gate mechanism.
- Tune the heartbeat interval to avoid flooding the link.

## Building

1. Install the Arduino IDE or `arduino-cli`.
2. Install required libraries via the Library Manager:
   - `Servo`
   - `LiquidCrystal_I2C` (if using an I2C LCD)
   - `Keypad` (if using a membrane keypad)
3. Adjust pins and library includes as needed.
4. Upload to the Arduino UNO.

## Testing

- Use the bridge or simulator to send commands.
- Confirm the gate starts closed.
- Confirm sensor events are reported.
- Confirm the gate only moves on authorised commands.
