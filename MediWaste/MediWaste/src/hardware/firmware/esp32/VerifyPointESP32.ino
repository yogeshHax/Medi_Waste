/*
  MedWaste VerifyPoint — ESP32 station firmware (BLE protocol v1)
  ===============================================================

  Flow: PHONE --BLE--> ESP32 --HTTPS--> BACKEND --> FIRESTORE
              <--BLE notify-- RESPONSE

  Hardware (exact wiring — see src/hardware/firmware/esp32/README.md):
    - IR presence sensor OUT -> GPIO 27                   (3.3 V logic only)
    - HC-SR04 TRIG -> GPIO 4, ECHO -> GPIO 18 (via divider, NEVER bare 5 V)
    - 16x2 LCD, 4-bit parallel: RS 13, E 14, D4 16, D5 17, D6 21, D7 22
    - Servo signal -> GPIO 19 (separate supply, common ground)
    - Green LED -> GPIO 25, Red LED -> GPIO 26 (220-330 ohm resistors)
    - Reset button -> GPIO 33 with INPUT_PULLUP (other terminal -> GND)

  SAFETY MODEL (do not change without updating the backend):
    - The gate is CLOSED by default and after every uncertainty.
    - Only a backend response with status REQUEST_ACCEPTED may open the gate.
    - Phone messages, sensor readings and the reset button never open the gate.
    - Commanded gate movement is reported as "commanded", never as "confirmed"
      (no position feedback sensor is fitted).
    - This firmware makes no medicine-authenticity or safety decisions.

  Libraries needed (Arduino IDE Library Manager):
    - LiquidCrystal (bundled with the arduino-esp32 core)
    - ESP32 built-in: WiFi, WiFiClientSecure, HTTPClient, Preferences,
      BLE (Bluedroid), ESP32Servo (by Kevin Harrington)
*/

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <LiquidCrystal.h>
#include <ESP32Servo.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <math.h>

// ---------------------------------------------------------------------------
// Build-time configuration — fill in BEFORE flashing. Nothing sensitive is
// stored in the firmware: Wi-Fi SSID/password, station token and backend URL
// are provisioned at runtime and kept in NVS (Preferences).
// ---------------------------------------------------------------------------
#define FIRMWARE_VERSION        "1.0.0"
#define PROTOCOL_VERSION        1

// Backend endpoint (the deployed stationHttpRequest function). No secrets here.
#ifndef BACKEND_URL
#define BACKEND_URL             "https://europe-west2-PROJECT_ID.cloudfunctions.net/stationHttpRequest"
#endif

// Pin map — matches the project hardware specification exactly.
#define PIN_IR_SENSOR           27
#define PIN_US_TRIG             4
#define PIN_US_ECHO             18
#define PIN_LCD_RS              13
#define PIN_LCD_E               14
#define PIN_LCD_D4              16
#define PIN_LCD_D5              17
#define PIN_LCD_D6              21
#define PIN_LCD_D7              22
#define PIN_SERVO               19
#define PIN_LED_GREEN           25
#define PIN_LED_RED             26
#define PIN_RESET_BUTTON        33

// Behaviour tuning.
#define US_MAX_RANGE_CM         120    // beyond this, report "unavailable"
#define US_TIMEOUT_US           30000  // ~5 m round trip
#define US_SAMPLES              3      // median-of-3 for stability
#define GATE_OPEN_MS            5000   // gate auto-recloses after this interval
#define CMD_RATE_MS             20     // servo refresh period
#define WIFI_CONNECT_TIMEOUT_MS 15000
#define SENSOR_SAMPLE_MS        800
#define RECONNECT_CHECK_MS      2000
#define HTTPS_TIMEOUT_MS        10000
#define STREAM_BUFSZ            4096   // ArduinoJson filter/parse buffer

// Server certificate: embed (or point to) the Google Trust Services root that
// signs *.cloudfunctions.net ("GTS Root R4" chains). Place the PEM in
// certs/gts_root_r4.h as ROOT_CA_PEM, or compile without TLS verification by
// explicitly setting ALLOW_INSECURE_TLS — which prints a permanent warning.
#if __has_include(<gts_root_r4.h>)
  #include <gts_root_r4.h>       // defines ROOT_CA_PEM
#else
  #warning "certs/gts_root_r4.h missing — TLS verification DISABLED (demo only)."
  const char ROOT_CA_PEM[] = "";
  static const bool ALLOW_INSECURE_TLS = true;
#endif

// ---------------------------------------------------------------------------
// Runtime config (NVS): stationId, wifiSsid, wifiPass, stationToken
// ---------------------------------------------------------------------------
Preferences prefs;
String stationId    = "station-1";
String wifiSsid     = "";
String wifiPass     = "";
String stationToken = "";

// ---------------------------------------------------------------------------
// Peripherals
// ---------------------------------------------------------------------------
LiquidCrystal lcd(PIN_LCD_RS, PIN_LCD_E, PIN_LCD_D4, PIN_LCD_D5, PIN_LCD_D6, PIN_LCD_D7);
Servo gateServo;

enum GateState { GATE_CLOSED, GATE_COMMANDED_OPEN };
GateState gateState = GATE_CLOSED;              // default CLOSED
unsigned long gateOpenedAt = 0;

enum LedColor { LED_OFF, LED_GREEN, LED_RED };
LedColor ledColor = LED_OFF;

// Sensor latched state (reported over BLE + used only for context display).
bool    irDetected   = false;
int     distanceCm   = -1;                      // -1 = unavailable, never fabricated
String  distanceLabel = "n/a";

// BLE
BLEServer*         bleServer  = nullptr;
BLECharacteristic* bleTxChar  = nullptr;      // ESP32 -> phone (notify)
BLECharacteristic* bleRxChar  = nullptr;      // phone -> ESP32 (write)
volatile bool      bleConnected     = false;
String             lastRequestMsgId = "";      // dedupe of phone messages

// Non-blocking loop timers
unsigned long tSensor   = 0;
unsigned long tNet      = 0;
unsigned long tBleAdvert= 0;
unsigned long tBlink    = 0;

// Simple LCD helpers ---------------------------------------------------------
void lcdLine(uint8_t row, const char* text) {
  char buf[17];
  snprintf(buf, sizeof(buf), "%-16.16s", text);
  lcd.setCursor(0, row);
  lcd.print(buf);
}

void lcdTwo(const char* line1, const char* line2) {
  lcdLine(0, line1);
  lcdLine(1, line2);
}

// LED ---------------------------------------------------------------
void setLed(LedColor color) {
  ledColor = color;
  digitalWrite(PIN_LED_GREEN, color == LED_GREEN ? HIGH : LOW);
  digitalWrite(PIN_LED_RED,   color == LED_RED   ? HIGH : LOW);
}

// Gate --------------------------------------------------------------
// Only call from a path validated by processBackendResponse().
void commandGateOpen() {
  // 85deg clears the demonstration chute (calibrate per installation).
  gateServo.write(85);
  gateState = GATE_COMMANDED_OPEN;
  gateOpenedAt = millis();
  setLed(LED_GREEN);
  lcdTwo("ACCEPTED", "Gate open 5s");
}

void commandGateClose() {
  gateServo.write(15);                          // hard reclose on any action
  gateState = GATE_CLOSED;
  gateOpenedAt  = 0;
  setLed(ledColor == LED_GREEN ? LED_OFF : ledColor);
  lcdTwo("Accepted", "Gate closed");
}

inline bool gateIsCommandedOpen() { return gateState == GATE_COMMANDED_OPEN; }

// Sensors -------------------------------------------------------------------
// Median-of-3 with hard timeout. Invalid readings report as "unavailable";
// they are NEVER turned into a plausible distance value.
int readUltrasonicMedian() {
  long samples[US_SAMPLES];
  int valid = 0;
  for (int i = 0; i < US_SAMPLES; i++) {
    digitalWrite(PIN_US_TRIG, LOW);
    delayMicroseconds(3);
    digitalWrite(PIN_US_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_US_TRIG, LOW);
    long dur = pulseIn(PIN_US_ECHO, HIGH, US_TIMEOUT_US);
    if (dur > 0) {
      long cm = dur / 58;
      if (cm >= 2 && cm <= US_MAX_RANGE_CM) samples[valid++] = cm;
    }
    delayMicroseconds(600);                     // settle between pings
  }
  if (valid == 0) return -1;
  // median of whatever samples landed
  for (int i = 1; i < valid; i++) {             // tiny insertion sort (n<=3)
    long key = samples[i];
    int j = i - 1;
    while (j >= 0 && samples[j] > key) { samples[j+1] = samples[j]; j--; }
    samples[j+1] = key;
  }
  return (int)samples[valid / 2];
}

void sampleSensors() {
  irDetected = digitalRead(PIN_IR_SENSOR) == HIGH;   // module config dependent
  int d = readUltrasonicMedian();
  distanceCm = d;                                    // -1 stays unavailable
  if (d >= 0) {
    distanceLabel = String(d) + "cm";
  } else {
    distanceLabel = "unavail";                       // explicit, never faked
  }
}

// Wi-Fi ------------------------------------------------------------------
bool wifiConnected() { return WiFi.status() == WL_CONNECTED; }

void wifiShowStatus() {
  if (wifiConnected()) {
    lcdTwo("Wi-Fi ok", WiFi.localIP().toString().c_str());
  } else {
    lcdTwo("Wi-Fi connecting", wifiSsid.c_str());
  }
}

void ensureWifi() {
  if (wifiConnected()) return;
  lcdTwo("Wi-Fi connecting", wifiSsid.c_str());
  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  unsigned long start = millis();
  while (!wifiConnected() && millis() - start < WIFI_CONNECT_TIMEOUT_MS) {
    delay(300);
  }
  if (wifiConnected()) {
    lcdTwo("Wi-Fi ok", WiFi.localIP().toString().c_str());
    setLed(ledColor);                             // restore current color
  } else {
    lcdTwo("Wi-Fi FAILED", "will retry...");
  }
}

// Provisioning ---------------------------------------------------------
// First boot (or double-press reset within 3 s): type the values over USB
// serial. Commands:
//   SET ID <stationId>
//   SET SSID <wifi ssid>
//   SET PASS <wifi password>
//   SET TOKEN <station provisioning bearer token>
//   SHOW
//   WIPE    (clears NVS and reboots)
bool handleSerialLine(const String& line) {
  String l = line; l.trim();
  if (l.length() == 0) return false;
  if (l.startsWith("SET ID "))   { stationId    = l.substring(8); prefs.putString("sid", stationId); }
  else if (l.startsWith("SET SSID")){ wifiSsid   = l.substring(9); prefs.putString("ssid", wifiSsid); }
  else if (l.startsWith("SET PASS")){ wifiPass   = l.substring(9); prefs.putString("pass", wifiPass); }
  else if (l.startsWith("SET TOKEN")){ stationToken = l.substring(10); prefs.putString("tok", stationToken); }
  else if (l == "SHOW") {
    Serial.printf("ID=%s SSID=%s TOKEN=%s URL=%s\n",
                  stationId.c_str(),
                  wifiSsid.length() ? wifiSsid.c_str() : "(unset)",
                  stationToken.length() ? "(set)" : "(unset)",
                  BACKEND_URL);
  } else if (l == "WIPE") {
    prefs.clear();
    Serial.println("NVS cleared; rebooting.");
    delay(200);
    esp_restart();
  } else if (l == "SAVE") {
    prefs.putString("sid", stationId);
    prefs.putString("ssid", wifiSsid);
    prefs.putString("pass", wifiPass);
    prefs.putString("tok", stationToken);
  } else {
    Serial.println("Unknown command. Use: SET ID|SSID|PASS|TOKEN <value> / SHOW / SAVE / WIPE");
    return false;
  }
  Serial.println("OK");
  return true;
}

void loadConfig() {
  prefs.begin("verifypt", false);
  String s = prefs.getString("sid", "");
  if (s.length()) stationId = s;
  wifiSsid     = prefs.getString("ssid", "");
  wifiPass     = prefs.getString("pass", "");
  stationToken = prefs.getString("tok", "");
  if (wifiSsid.length() == 0) {                  // first boot: no stored SSID
    lcdTwo("Provision me", "USB serial SET ...");
    Serial.setDebugOutput(false);
    Serial.println("\n[provision] Type SET SSID <...>, SET PASS <...>, SET TOKEN <...>, SET ID <...> then SAVE");
    String line = "";
    unsigned long idle = millis();
    while (wifiSsid.length() == 0) {
      while (Serial.available()) {
        char c = (char)Serial.read();
        if (c == '\n' || c == '\r') {
          handleSerialLine(line); line = "";
        } else if (isPrintable(c)) line += c;
      }
      if (millis() - idle > 30000) {
        lcdTwo("Waiting config", "USB serial");
        idle = millis();
      }
      delay(20);
      if (wifiSsid.length() > 0) break;          // escape once SSID is set
    }
  }
}

// BLE -----------------------------------------------------------------------
class BleServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    bleConnected = true;
    lcdLine(1, "phone connected");
  }
  void onDisconnect(BLEServer*) override {
    bleConnected = false;
    lcdLine(1, "waiting phone");
    BLEDevice::startAdvertising();               // reconnect hygiene
  }
};

void bleNotify(const String& json) {
  if (bleTxChar && bleConnected) {
    bleTxChar->setValue((uint8_t*)json.c_str(), (size_t)json.length());
    bleTxChar->notify();
  }
}

void bleNotifyAck(const String& msgId) {
  // ACK = transport-level only. It means "I received your frame", never
  // "your request was approved". The semantic response follows separately.
  String ack = "{\"v\":" + String(PROTOCOL_VERSION) + ",\"type\":\"ack\",\"echo\":\"" + msgId + "\"}";
  bleNotify(ack);
}

void bleNotifyError(const String& reason, const String& echo) {
  String out = "{\"v\":" + String(PROTOCOL_VERSION) + ",\"type\":\"error\",\"reason\":\"" + reason + "\",\"echo\":\"" + echo + "\"}";
  bleNotify(out);
}

// Validates and routes one phone->station frame. Rejects duplicates.
void handleBleWrite(const String& payload) {
  JsonDocument doc;                              // ArduinoJson v7
  DeserializationError err = deserializeJson(doc, payload);
  if (err) { bleNotifyError("malformed", ""); return; }

  if ((int)(doc["v"] | 0) != PROTOCOL_VERSION) {
    bleNotifyError("unsupported_version", doc["msgId"].as<String>());
    return;
  }
  String msgId = doc["msgId"].as<String>();
  String op    = doc["operation"].as<String>();
  String donId = doc["donationId"].as<String>();
  String reqStation = doc["stationId"].as<String>();
  if (msgId.length() < 4 || op.length() == 0 || donId.length() == 0) {
    bleNotifyError("malformed", msgId);
    return;
  }
  // Duplicate frames from a flappy phone radio are rejected, not re-executed.
  if (msgId == lastRequestMsgId) {
    bleNotifyError("duplicate", msgId);
    return;
  }
  lastRequestMsgId = msgId;

  bleNotifyAck(msgId);                           // transport ack FIRST
  lcdTwo((String("Check ID ") + donId).c_str(), "talking backend");
  submitToBackend(msgId, op, donId, reqStation);
}

class BleRxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* ch) override {
    String value = ch->getValue();
    handleBleWrite(value);
  }
};

void setupBle() {
  BLEDevice::init("VerifyPoint");                // adv. name the phone scans for
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new BleServerCallbacks());

  BLEService* svc = bleServer->createService("0000ffe0-0000-1000-8000-00805f9b34fb");
  bleTxChar = svc->createCharacteristic(
      "0000ffe1-0000-1000-8000-00805f9b34fb",    // notify: response frames
      BLECharacteristic::PROPERTY_NOTIFY);
  bleTxChar->addDescriptor(new BLE2902());

  bleRxChar = svc->createCharacteristic(
      "0000ffe2-0000-1000-8000-00805f9b34fb",    // write: request frames
      BLECharacteristic::PROPERTY_WRITE |
      BLECharacteristic::PROPERTY_WRITE_NR);
  bleRxChar->setCallbacks(new BleRxCallbacks());
  svc->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID("0000ffe0-0000-1000-8000-00805f9b34fb");
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
}

// Backend HTTPS -------------------------------------------------------------
// Returns the parsed status string, or "" on transport failure.
String submitToBackend(const String& msgId, const String& op, const String& donationId,
                       const String& reqStation) {
  HTTPClient http;
  WiFiClientSecure client;
  if (ROOT_CA_PEM[0] != '\0') {
    client.setCACert(ROOT_CA_PEM);               // verified TLS always
  } else {
    // Demo build with ALLOW_INSECURE_TLS: never ship this configuration.
    client.setInsecure();
    Serial.println("[WARN] TLS certificate verification DISABLED (missing certs/gts_root_r4.h)");
  }
  client.setTimeout(HTTPS_TIMEOUT_MS / 1000);
  http.setConnectTimeout(HTTPS_TIMEOUT_MS);
  http.setTimeout(HTTPS_TIMEOUT_MS);

  String url = BACKEND_URL;
  if (!http.begin(client, url)) {
    processBackendResponse(msgId, op, "NETWORK_ERROR", "", "", "backend config/unreachable");
    return "";
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + stationToken);

  JsonDocument body;
  body["v"]           = PROTOCOL_VERSION;
  body["msgId"]       = msgId;
  body["stationId"]   = stationId;               // server checks == token station
  body["operation"]   = op;
  body["donationId"]  = donationId;
  body["deviceSerial"] = "esp32-" + String((uint32_t)(ESP.getEfuseMac() & 0xFFFFFFFF), HEX);

  String bodyStr;
  serializeJson(body, bodyStr);
  int code = http.POST(bodyStr);

  if (code != 200) {                             // transport / auth failure
    http.end();
    const String status = (code == 401 || code == 403) ? "UNAUTHORISED" : "SERVER_ERROR";
    processBackendResponse(msgId, op, status, "", "", String("HTTP ") + code);
    return "";
  }

  String resp = http.getString();
  http.end();

  JsonDocument rdoc;
  if (deserializeJson(rdoc, resp)) {
    processBackendResponse(msgId, op, "SERVER_ERROR", "", "", "bad backend response");
    return "";
  }

  String status = rdoc["status"].as<String>();
  processBackendResponse(msgId, op, status, rdoc["currentStatus"].as<String>(),
                         rdoc["donationCode"].as<String>(), rdoc["detail"].as<String>());
  return status;
}

// The ONLY place a gate command may be issued.
void processBackendResponse(const String& msgId, const String& operation, const String& status,
                            const String& currentStatus, const String& donationCode,
                            const String& detail) {
  String row2 = detail.length() ? detail : status;
  String line1 = (donationCode.length() ? donationCode : "Result") + String(" ") + msgId.substring(0, 6);

  const bool intakeAccepted = (status == "REQUEST_ACCEPTED" && operation == "intake_registered");
  if (intakeAccepted) {                          // the single gate-authorising case
    line1 = "ACCEPTED " + (donationCode.length() ? donationCode : msgId.substring(0, 8));
    lcdTwo("ACCEPTED", row2.c_str());
    // The acceptance gate opens ONLY for an accepted intake check-in. A review
    // decision or inspection transition must never open the physical gate.
    commandGateOpen();
  } else if (status == "REQUEST_ACCEPTED") {     // accepted, but not an intake
    lcdTwo("ACCEPTED", "no gate action");
    setLed(LED_GREEN);
  } else {
    line1 = status;
    lcdTwo(line1.c_str(), row2.c_str());
    if (status == "UNKNOWN_ID" || status == "ALREADY_PROCESSED" ||
        status == "UNAUTHORISED" || status == "INVALID_MESSAGE") {
      setLed(LED_RED);
      tone(2, 180, 220);                          // low buzz on hard refusals
    } else {
      setLed(LED_OFF);
    }
  }
  // Serialise with ArduinoJson so quotes in detail can never break the frame.
  JsonDocument out;
  out["v"] = PROTOCOL_VERSION;
  out["type"] = "response";
  out["status"] = status;
  out["ack"] = true;
  out["msgId"] = msgId;
  out["currentStatus"] = currentStatus;
  out["donationCode"] = donationCode;
  out["detail"] = detail;
  String outStr;
  serializeJson(out, outStr);
  bleNotify(outStr);
}

// Reset button --------------------------------------------------------------
// Device-side re-verification only: re-request Wi-Fi + BLE advertisement.
// It can never authorise a gate opening or bypass backend validation.
void setupButton() {
  pinMode(PIN_RESET_BUTTON, INPUT_PULLUP);
}
bool buttonPressed() { return digitalRead(PIN_RESET_BUTTON) == LOW; }

// ---------------------------------------------------------------------------
// Setup / loop — fully non-blocking (no delay() past first boot)
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(PIN_IR_SENSOR, INPUT);
  pinMode(PIN_US_TRIG, OUTPUT);
  pinMode(PIN_US_ECHO, INPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  setupButton();

  lcd.begin(16, 2);
  lcdTwo("VerifyPoint v" FIRMWARE_VERSION, "starting");

  // Servo on its own supply; never from the ESP32 3V3 pin.
  gateServo.attach(PIN_SERVO, 500, 2400);
  gateServo.write(15);                           // SAFE DEFAULT: gate closed
  delay(300);                                    // let the servo reach CLOSED

  loadConfig();                                  // blocks on first-boot prompt
  ensureWifi();
  setupBle();
  lcdTwo("Station " + stationId.substring(0, 10), "BLE+WiFi ready");
}

void loop() {
  unsigned long now = millis();

  // 1. Sensors (non-blocking cadence; HC-SR04 pulses inside pulseIn for <25ms).
  if (now - tSensor >= SENSOR_SAMPLE_MS) {
    tSensor = now;
    sampleSensors();
    if (gateIsCommandedOpen() && now - gateOpenedAt >= GATE_OPEN_MS) {
      commandGateClose();                        // auto-reclose for safety
    }
  }

  // 2. Wi-Fi supervision.
  if (now - tNet >= RECONNECT_CHECK_MS) {
    tNet = now;
    if (!wifiConnected()) { ensureWifi(); }
  }

  // 3. BLE re-advertise when a phone drops.
  if (!bleConnected && now - tBleAdvert >= 5000) {
    tBleAdvert = now;
    BLEDevice::startAdvertising();
  }

  // 4. USB serial configuration console.
  if (Serial.available()) {
    String line = "";
    while (Serial.available()) {
      char c = (char)Serial.read();
      if (c == '\n') { handleSerialLine(line); line = ""; }
      else if (isPrintable(c)) line += c;
    }
  }

  // 5. Heartbeat LED while idle.
  if (ledColor == LED_GREEN || ledColor == LED_RED) {
    // solid; no blink logic needed here
  }

  delay(5);                                      // small scheduler tick
}
