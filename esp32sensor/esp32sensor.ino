/*
  ESP32 people-presence sensor using only built-in radios.

  What it can do:
  - Count nearby Bluetooth LE advertisers such as phones, watches, earbuds,
    tags, and laptops.
  - Run a simple Wi-Fi CSI motion/presence experiment against your router.
  - Passively count nearby Wi-Fi client probe/data transmitters by RSSI.
  - Watch nearby Wi-Fi access-point signal changes as a weak secondary hint.
  - Serve a cached browser dashboard.

  What it cannot do reliably:
  - Count exact people.
  - Detect every phone. Many devices randomize MAC addresses or stop
    advertising when asleep.
  - Identify people. This sketch intentionally hashes device addresses in RAM
    only and does not store or print MAC addresses.

  Arduino IDE:
  - Board: an ESP32 board such as "ESP32 Dev Module"
  - Libraries: built-in WiFi/WebServer/DNSServer/ESPmDNS + ESP32 BLE Arduino
  - Serial Monitor: 115200 baud
*/

#include <Arduino.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <esp_wifi.h>
#include <math.h>

// Put your router Wi-Fi here for http://esp32sensor.local/.
// Leave WIFI_SSID blank to use fallback access-point mode only.
static const char *WIFI_SSID = "craGTLab";
static const char *WIFI_PASSWORD = "craGT7013";
static const char *MDNS_NAME = "esp32sensor";

// Fallback direct ESP32 Wi-Fi. Connect to this network if router mode is off
// or cannot connect, then browse to http://192.168.4.1/.
static const char *AP_SSID = "ESP32-Presence";
static const char *AP_PASSWORD = "presence123";  // At least 8 chars.

// Tune these for your room.
static const bool ENABLE_SERIAL_LOG = false;
static const bool ENABLE_CSI_TEST = true;
static const int BLE_SCAN_SECONDS = 1;
static const int BLE_SCAN_PERIOD_MS = 5000;
static const int WIFI_SCAN_PERIOD_MS = 30000;
static const int CSI_STIMULUS_PERIOD_MS = 1000;
static const int CSI_BASELINE_LEARN_MS = 30000;
static const int CSI_MOTION_THRESHOLD = 18;
static const int STATUS_CACHE_PERIOD_MS = 1000;
static const int REPORT_PERIOD_MS = 10000;
static const int BLE_NEAR_RSSI = -82;       // Closer to 0 means nearer.
static const int WIFI_CLIENT_NEAR_RSSI = -78;
static const int WIFI_NEAR_RSSI = -78;
static const int DEVICE_TTL_MS = 90000;     // Forget devices not seen recently.
static const int MAX_TRACKED_DEVICES = 80;
static const int PRESENCE_ON_SCORE = 2;
static const int PRESENCE_OFF_SCORE = 1;

struct SeenDevice {
  uint32_t hash;
  int rssi;
  unsigned long lastSeenMs;
  bool inUse;
};

SeenDevice bleDevices[MAX_TRACKED_DEVICES];
SeenDevice wifiDevices[MAX_TRACKED_DEVICES];

WebServer server(80);
DNSServer dnsServer;
WiFiUDP csiUdp;
BLEScan *bleScan = nullptr;
unsigned long lastWifiScanMs = 0;
unsigned long lastBleScanMs = 0;
unsigned long lastReportMs = 0;
unsigned long lastStatusCacheMs = 0;
unsigned long lastCsiStimulusMs = 0;
int lastWifiNearCount = 0;
int lastWifiClientNearCount = 0;
int lastWifiClientTotalCount = 0;
int lastBleNearCount = 0;
int lastBleTotalCount = 0;
int lastCsiMotionScore = 0;
int lastCsiPacketCount = 0;
int lastCsiRssi = 0;
int lastScore = 0;
bool roomOccupied = false;
bool apMode = false;
bool mdnsStarted = false;
bool lastCsiReady = false;
bool lastCsiPresence = false;
String statusCacheJson = "{}";

portMUX_TYPE csiMux = portMUX_INITIALIZER_UNLOCKED;
float csiBaseline = 0.0f;
float csiMotionScore = 0.0f;
volatile uint32_t csiPacketCount = 0;
unsigned long csiStartedAtMs = 0;
unsigned long lastCsiPacketMs = 0;
int csiLastRssi = 0;
bool csiBaselineReady = false;

const char INDEX_HTML[] PROGMEM = R"HTML(
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ESP32 Presence</title>
  <style>
    :root { color-scheme: light dark; font-family: Arial, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #101820; color: #f8fbff; }
    main { width: min(92vw, 560px); padding: 28px; border: 1px solid #344553; border-radius: 8px; background: #17232d; }
    h1 { margin: 0 0 18px; font-size: 28px; letter-spacing: 0; }
    .status { display: flex; align-items: baseline; gap: 12px; margin: 20px 0; }
    .dot { width: 18px; height: 18px; border-radius: 50%; background: #8b98a5; box-shadow: 0 0 18px #8b98a5; flex: 0 0 auto; }
    .yes .dot { background: #33d17a; box-shadow: 0 0 20px #33d17a; }
    .no .dot { background: #ff6b6b; box-shadow: 0 0 20px #ff6b6b; }
    .presence { font-size: 44px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .metric { padding: 14px; border: 1px solid #2c3b47; border-radius: 8px; background: #0f1921; }
    .label { color: #9fb0bf; font-size: 13px; }
    .value { display: block; margin-top: 6px; font-size: 24px; font-weight: 700; overflow-wrap: anywhere; }
    .actions { margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap; }
    button { border: 1px solid #4a6072; border-radius: 6px; background: #20313f; color: #f8fbff; padding: 10px 12px; font: inherit; cursor: pointer; }
    button:hover { background: #2a4052; }
    .hint { margin-top: 18px; color: #9fb0bf; font-size: 14px; line-height: 1.45; }
  </style>
</head>
<body>
  <main id="app" class="no">
    <h1>ESP32 Presence</h1>
    <section class="status">
      <span class="dot"></span>
      <span id="presence" class="presence">...</span>
    </section>
    <section class="grid">
      <div class="metric"><span class="label">Level</span><span id="level" class="value">...</span></div>
      <div class="metric"><span class="label">Score</span><span id="score" class="value">...</span></div>
      <div class="metric"><span class="label">BLE near</span><span id="bleNear" class="value">...</span></div>
      <div class="metric"><span class="label">BLE total</span><span id="bleTotal" class="value">...</span></div>
      <div class="metric"><span class="label">Wi-Fi clients near</span><span id="wifiClientNear" class="value">...</span></div>
      <div class="metric"><span class="label">Wi-Fi clients total</span><span id="wifiClientTotal" class="value">...</span></div>
      <div class="metric"><span class="label">CSI status</span><span id="csiStatus" class="value">...</span></div>
      <div class="metric"><span class="label">CSI motion</span><span id="csiMotion" class="value">...</span></div>
      <div class="metric"><span class="label">CSI packets</span><span id="csiPackets" class="value">...</span></div>
      <div class="metric"><span class="label">CSI RSSI</span><span id="csiRssi" class="value">...</span></div>
      <div class="metric"><span class="label">Wi-Fi APs near</span><span id="wifiNear" class="value">...</span></div>
      <div class="metric"><span class="label">Uptime</span><span id="uptime" class="value">...</span></div>
    </section>
    <section class="actions">
      <button type="button" onclick="resetCsi()">Reset CSI baseline</button>
    </section>
    <p id="net" class="hint"></p>
  </main>
  <script>
    async function refresh() {
      const res = await fetch('/api/status', { cache: 'no-store' });
      const data = await res.json();
      app.className = data.occupied ? 'yes' : 'no';
      presence.textContent = data.occupied ? 'YES' : 'NO';
      level.textContent = data.level;
      score.textContent = data.score;
      bleNear.textContent = data.ble_near;
      bleTotal.textContent = data.ble_total;
      wifiClientNear.textContent = data.wifi_clients_near;
      wifiClientTotal.textContent = data.wifi_clients_total;
      csiStatus.textContent = data.csi_status;
      csiMotion.textContent = data.csi_motion;
      csiPackets.textContent = data.csi_packets;
      csiRssi.textContent = data.csi_rssi;
      wifiNear.textContent = data.wifi_aps_near;
      uptime.textContent = Math.floor(data.uptime_ms / 1000) + 's';
      net.textContent = data.network;
    }
    async function resetCsi() {
      await fetch('/api/csi/reset', { method: 'POST', cache: 'no-store' });
      await refresh();
    }
    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>
)HTML";

uint32_t fnv1aHash(const char *value) {
  uint32_t hash = 2166136261UL;
  while (*value != '\0') {
    hash ^= static_cast<uint8_t>(*value);
    hash *= 16777619UL;
    value++;
  }
  return hash;
}

uint32_t fnv1aHashBytes(const uint8_t *value, size_t length) {
  uint32_t hash = 2166136261UL;
  for (size_t i = 0; i < length; i++) {
    hash ^= value[i];
    hash *= 16777619UL;
  }
  return hash;
}

void rememberDevice(SeenDevice devices[], uint32_t hash, int rssi) {
  int freeSlot = -1;
  for (int i = 0; i < MAX_TRACKED_DEVICES; i++) {
    if (devices[i].inUse && devices[i].hash == hash) {
      devices[i].rssi = rssi;
      devices[i].lastSeenMs = millis();
      return;
    }
    if (!devices[i].inUse && freeSlot == -1) {
      freeSlot = i;
    }
  }

  if (freeSlot == -1) {
    int oldest = 0;
    for (int i = 1; i < MAX_TRACKED_DEVICES; i++) {
      if (devices[i].lastSeenMs < devices[oldest].lastSeenMs) {
        oldest = i;
      }
    }
    freeSlot = oldest;
  }

  devices[freeSlot] = {hash, rssi, millis(), true};
}

void rememberBleDevice(uint32_t hash, int rssi) {
  rememberDevice(bleDevices, hash, rssi);
}

void rememberWifiDevice(uint32_t hash, int rssi) {
  rememberDevice(wifiDevices, hash, rssi);
}

void expireOldDevices(SeenDevice devices[]) {
  const unsigned long now = millis();
  for (int i = 0; i < MAX_TRACKED_DEVICES; i++) {
    if (devices[i].inUse && now - devices[i].lastSeenMs > DEVICE_TTL_MS) {
      devices[i].inUse = false;
    }
  }
}

void countDevices(SeenDevice devices[], int nearRssi, int &totalCount, int &nearCount) {
  expireOldDevices(devices);
  totalCount = 0;
  nearCount = 0;

  for (int i = 0; i < MAX_TRACKED_DEVICES; i++) {
    if (!devices[i].inUse) {
      continue;
    }

    totalCount++;
    if (devices[i].rssi >= nearRssi) {
      nearCount++;
    }
  }
}

void countBleDevices(int &totalCount, int &nearCount) {
  countDevices(bleDevices, BLE_NEAR_RSSI, totalCount, nearCount);
}

void countWifiClientDevices(int &totalCount, int &nearCount) {
  countDevices(wifiDevices, WIFI_CLIENT_NEAR_RSSI, totalCount, nearCount);
}

bool macEquals(const uint8_t *a, const uint8_t *b) {
  for (int i = 0; i < 6; i++) {
    if (a[i] != b[i]) {
      return false;
    }
  }
  return true;
}

bool isOwnRouterMac(const uint8_t *mac) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  return macEquals(mac, WiFi.BSSID());
}

void wifiPromiscuousCallback(void *buf, wifi_promiscuous_pkt_type_t type);

void resetCsiBaseline() {
  portENTER_CRITICAL(&csiMux);
  csiBaseline = 0.0f;
  csiMotionScore = 0.0f;
  csiPacketCount = 0;
  csiStartedAtMs = millis();
  lastCsiPacketMs = 0;
  csiLastRssi = 0;
  csiBaselineReady = false;
  portEXIT_CRITICAL(&csiMux);
}

void updateCsiSnapshot() {
  portENTER_CRITICAL(&csiMux);
  const uint32_t packets = csiPacketCount;
  const float motion = csiMotionScore;
  const bool ready = csiBaselineReady;
  const unsigned long packetMs = lastCsiPacketMs;
  const int rssi = csiLastRssi;
  portEXIT_CRITICAL(&csiMux);

  lastCsiPacketCount = packets > 999999 ? 999999 : static_cast<int>(packets);
  lastCsiMotionScore = static_cast<int>(motion + 0.5f);
  lastCsiReady = ready;
  lastCsiRssi = rssi;
  lastCsiPresence = ready && millis() - packetMs < 10000 && lastCsiMotionScore >= CSI_MOTION_THRESHOLD;
}

String csiStatusLabel() {
  if (!ENABLE_CSI_TEST) {
    return "off";
  }
  if (WiFi.status() != WL_CONNECTED) {
    return "needs router";
  }
  if (lastCsiPacketCount == 0 || millis() - lastCsiPacketMs > 10000) {
    return "no packets";
  }
  if (!lastCsiReady) {
    return "learning";
  }
  if (lastCsiPresence) {
    return "motion";
  }
  return "quiet";
}

void wifiCsiCallback(void *ctx, wifi_csi_info_t *data) {
  if (!ENABLE_CSI_TEST || data == nullptr || data->buf == nullptr || data->len < 8) {
    return;
  }

  uint32_t sum = 0;
  uint16_t pairs = 0;
  const uint16_t start = data->first_word_invalid ? 4 : 0;
  for (uint16_t i = start; i + 1 < data->len; i += 2) {
    sum += abs(static_cast<int>(data->buf[i]));
    sum += abs(static_cast<int>(data->buf[i + 1]));
    pairs++;
  }

  if (pairs == 0) {
    return;
  }

  const float amplitude = static_cast<float>(sum) / static_cast<float>(pairs);
  const unsigned long now = millis();

  portENTER_CRITICAL(&csiMux);
  if (csiPacketCount == 0 || csiBaseline <= 0.0f) {
    csiBaseline = amplitude;
  }

  const float diff = fabsf(amplitude - csiBaseline);
  csiMotionScore = (csiMotionScore * 0.82f) + (diff * 0.18f);

  const bool learning = now - csiStartedAtMs < CSI_BASELINE_LEARN_MS || csiPacketCount < 50;
  if (learning || csiMotionScore < (CSI_MOTION_THRESHOLD * 0.55f)) {
    csiBaseline = (csiBaseline * 0.99f) + (amplitude * 0.01f);
  }

  csiPacketCount++;
  lastCsiPacketMs = now;
  csiLastRssi = data->rx_ctrl.rssi;
  csiBaselineReady = !learning;
  portEXIT_CRITICAL(&csiMux);
}

void setupCsiTest() {
  if (!ENABLE_CSI_TEST || WiFi.status() != WL_CONNECTED) {
    return;
  }

  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);

  wifi_csi_config_t csiConfig = {};
  csiConfig.lltf_en = true;
  csiConfig.htltf_en = true;
  csiConfig.stbc_htltf2_en = true;
  csiConfig.ltf_merge_en = true;
  csiConfig.channel_filter_en = false;
  csiConfig.manu_scale = false;
  csiConfig.shift = 0;

  resetCsiBaseline();
  csiUdp.begin(53535);
  esp_wifi_set_csi(false);
  esp_wifi_set_csi_config(&csiConfig);
  esp_wifi_set_csi_rx_cb(wifiCsiCallback, nullptr);
  esp_wifi_set_csi(true);

  if (ENABLE_SERIAL_LOG) {
    Serial.println("CSI test started");
  }
}

void sendCsiStimulus() {
  if (!ENABLE_CSI_TEST || WiFi.status() != WL_CONNECTED) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastCsiStimulusMs < CSI_STIMULUS_PERIOD_MS) {
    return;
  }
  lastCsiStimulusMs = now;

  while (csiUdp.parsePacket() > 0) {
    while (csiUdp.available()) {
      csiUdp.read();
    }
  }

  static uint16_t dnsId = 1;
  dnsId++;
  const uint8_t dnsHeader[] = {
    static_cast<uint8_t>(dnsId >> 8), static_cast<uint8_t>(dnsId & 0xff),
    0x01, 0x00,  // Standard recursive query.
    0x00, 0x01,  // One question.
    0x00, 0x00,
    0x00, 0x00,
    0x00, 0x00
  };
  const uint8_t dnsQuestion[] = {
    6, 'r', 'o', 'u', 't', 'e', 'r',
    3, 'l', 'a', 'n',
    0,
    0x00, 0x01,  // A record.
    0x00, 0x01   // IN class.
  };

  csiUdp.beginPacket(WiFi.gatewayIP(), 53);
  csiUdp.write(dnsHeader, sizeof(dnsHeader));
  csiUdp.write(dnsQuestion, sizeof(dnsQuestion));
  csiUdp.endPacket();
}

void resumeWifiRadioSensing() {
  esp_wifi_set_promiscuous_rx_cb(wifiPromiscuousCallback);
  esp_wifi_set_promiscuous(true);
  if (ENABLE_CSI_TEST && WiFi.status() == WL_CONNECTED) {
    esp_wifi_set_csi(true);
  }
}

void wifiPromiscuousCallback(void *buf, wifi_promiscuous_pkt_type_t type) {
  if (type != WIFI_PKT_MGMT && type != WIFI_PKT_DATA) {
    return;
  }

  const wifi_promiscuous_pkt_t *packet = static_cast<wifi_promiscuous_pkt_t *>(buf);
  const uint8_t *payload = packet->payload;
  const int rssi = packet->rx_ctrl.rssi;
  if (rssi < WIFI_CLIENT_NEAR_RSSI - 12) {
    return;
  }

  const uint16_t frameControl = payload[0] | (payload[1] << 8);
  const uint8_t frameType = (frameControl & 0x000c) >> 2;
  const uint8_t frameSubtype = (frameControl & 0x00f0) >> 4;
  const bool toDs = frameControl & 0x0100;
  const bool fromDs = frameControl & 0x0200;
  const uint8_t *transmitter = payload + 10;

  bool clientLike = false;
  if (frameType == 0) {
    // Probe/association/auth frames usually come from client devices.
    clientLike = frameSubtype == 0 || frameSubtype == 2 || frameSubtype == 4 || frameSubtype == 11;
  } else if (frameType == 2) {
    // Data frames sent to the distribution system are commonly from clients.
    clientLike = toDs && !fromDs;
  }

  if (!clientLike || isOwnRouterMac(transmitter)) {
    return;
  }

  rememberWifiDevice(fnv1aHashBytes(transmitter, 6), rssi);
}

void setupWifiSensing() {
  esp_wifi_set_promiscuous(false);
  setupCsiTest();
  resumeWifiRadioSensing();
  if (ENABLE_SERIAL_LOG) {
    Serial.println("Passive Wi-Fi client sensing started");
  }
}

class PresenceAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    const int rssi = advertisedDevice.getRSSI();
    if (rssi < BLE_NEAR_RSSI - 12) {
      return;
    }

    // Hash in RAM so Serial output is useful without exposing device addresses.
    const uint32_t hash = fnv1aHash(advertisedDevice.getAddress().toString().c_str());
    rememberBleDevice(hash, rssi);
  }
};

void scanBle() {
  bleScan->start(BLE_SCAN_SECONDS, false);
  bleScan->clearResults();
  countBleDevices(lastBleTotalCount, lastBleNearCount);
}

void scanWifi() {
  esp_wifi_set_promiscuous(false);
  if (ENABLE_CSI_TEST) {
    esp_wifi_set_csi(false);
  }
  const int networkCount = WiFi.scanNetworks(false, true);
  int nearCount = 0;
  for (int i = 0; i < networkCount; i++) {
    if (WiFi.RSSI(i) >= WIFI_NEAR_RSSI) {
      nearCount++;
    }
  }

  lastWifiNearCount = nearCount;
  WiFi.scanDelete();
  lastWifiScanMs = millis();
  resumeWifiRadioSensing();
}

String presenceLabel(int score) {
  if (score >= 5) {
    return "busy";
  }
  if (score >= 2) {
    return "occupied";
  }
  return "empty";
}

void calculatePresence() {
  countWifiClientDevices(lastWifiClientTotalCount, lastWifiClientNearCount);
  updateCsiSnapshot();

  lastScore = 0;
  lastScore += lastBleNearCount * 2;
  lastScore += max(0, lastBleTotalCount - lastBleNearCount);
  lastScore += lastWifiClientNearCount * 2;
  lastScore += max(0, lastWifiClientTotalCount - lastWifiClientNearCount);

  if (lastCsiPresence) {
    lastScore += 3;
  } else if (lastCsiReady && lastCsiMotionScore >= CSI_MOTION_THRESHOLD / 2) {
    lastScore += 1;
  }

  // Wi-Fi APs are not people, but a changed/strong radio environment can help
  // avoid flicker when BLE devices briefly sleep.
  if (lastWifiNearCount >= 3) {
    lastScore += 1;
  }

  if (!roomOccupied && lastScore >= PRESENCE_ON_SCORE) {
    roomOccupied = true;
  } else if (roomOccupied && lastScore <= PRESENCE_OFF_SCORE) {
    roomOccupied = false;
  }
}

void updatePresence() {
  calculatePresence();

  if (ENABLE_SERIAL_LOG) {
    Serial.print("presence=");
    Serial.print(roomOccupied ? "yes" : "no");
    Serial.print(" level=");
    Serial.print(presenceLabel(lastScore));
    Serial.print(" score=");
    Serial.print(lastScore);
    Serial.print(" ble_near=");
    Serial.print(lastBleNearCount);
    Serial.print(" ble_total=");
    Serial.print(lastBleTotalCount);
    Serial.print(" wifi_clients_near=");
    Serial.print(lastWifiClientNearCount);
    Serial.print(" wifi_clients_total=");
    Serial.print(lastWifiClientTotalCount);
    Serial.print(" csi_status=");
    Serial.print(csiStatusLabel());
    Serial.print(" csi_motion=");
    Serial.print(lastCsiMotionScore);
    Serial.print(" csi_packets=");
    Serial.print(lastCsiPacketCount);
    Serial.print(" wifi_aps_near=");
    Serial.print(lastWifiNearCount);
    Serial.println();
  }
}

String networkSummary() {
  if (WiFi.status() == WL_CONNECTED) {
    return "Open http://" + String(MDNS_NAME) + ".local/ or http://" + WiFi.localIP().toString() + "/";
  }
  if (apMode) {
    return "Connected to fallback Wi-Fi " + String(AP_SSID) + ". Open http://192.168.4.1/.";
  }
  return "Wi-Fi is starting...";
}

String buildStatusJson() {
  calculatePresence();

  String json = "{";
  json += "\"occupied\":";
  json += roomOccupied ? "true" : "false";
  json += ",\"level\":\"" + presenceLabel(lastScore) + "\"";
  json += ",\"score\":" + String(lastScore);
  json += ",\"ble_near\":" + String(lastBleNearCount);
  json += ",\"ble_total\":" + String(lastBleTotalCount);
  json += ",\"wifi_clients_near\":" + String(lastWifiClientNearCount);
  json += ",\"wifi_clients_total\":" + String(lastWifiClientTotalCount);
  json += ",\"csi_status\":\"" + csiStatusLabel() + "\"";
  json += ",\"csi_motion\":" + String(lastCsiMotionScore);
  json += ",\"csi_packets\":" + String(lastCsiPacketCount);
  json += ",\"csi_rssi\":" + String(lastCsiRssi);
  json += ",\"csi_presence\":";
  json += lastCsiPresence ? "true" : "false";
  json += ",\"wifi_aps_near\":" + String(lastWifiNearCount);
  json += ",\"uptime_ms\":" + String(millis());
  json += ",\"network\":\"" + networkSummary() + "\"";
  json += "}";

  return json;
}

void updateStatusCache() {
  statusCacheJson = buildStatusJson();
  lastStatusCacheMs = millis();
}

void handleStatus() {
  if (statusCacheJson == "{}") {
    updateStatusCache();
  }

  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", statusCacheJson);
}

void handleCsiReset() {
  resetCsiBaseline();
  updateStatusCache();
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleRoot() {
  server.send_P(200, "text/html", INDEX_HTML);
}

void setupWebServer() {
  server.on("/", handleRoot);
  server.on("/api/status", handleStatus);
  server.on("/api/csi/reset", HTTP_POST, handleCsiReset);
  server.onNotFound(handleRoot);
  server.begin();
  if (ENABLE_SERIAL_LOG) {
    Serial.println("HTTP server started");
  }
}

void startFallbackAccessPoint() {
  apMode = true;
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASSWORD);

  const IPAddress apIp = WiFi.softAPIP();
  dnsServer.start(53, "*", apIp);

  if (ENABLE_SERIAL_LOG) {
    Serial.print("Fallback AP started: ");
    Serial.println(AP_SSID);
    Serial.print("Open: http://");
    Serial.print(apIp);
    Serial.println("/");
  }
}

void setupWifi() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.setHostname(MDNS_NAME);

  if (strlen(WIFI_SSID) == 0) {
    startFallbackAccessPoint();
    return;
  }

  if (ENABLE_SERIAL_LOG) {
    Serial.print("Connecting to Wi-Fi: ");
    Serial.println(WIFI_SSID);
  }
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 15000) {
    delay(250);
    if (ENABLE_SERIAL_LOG) {
      Serial.print(".");
    }
  }
  if (ENABLE_SERIAL_LOG) {
    Serial.println();
  }

  if (WiFi.status() == WL_CONNECTED) {
    if (ENABLE_SERIAL_LOG) {
      Serial.print("Wi-Fi connected: ");
      Serial.println(WiFi.localIP());
    }

    if (MDNS.begin(MDNS_NAME)) {
      mdnsStarted = true;
      MDNS.addService("http", "tcp", 80);
      if (ENABLE_SERIAL_LOG) {
        Serial.print("mDNS started: http://");
        Serial.print(MDNS_NAME);
        Serial.println(".local/");
      }
    } else {
      if (ENABLE_SERIAL_LOG) {
        Serial.println("mDNS failed; use the IP above.");
      }
    }
  } else {
    if (ENABLE_SERIAL_LOG) {
      Serial.println("Wi-Fi connection failed; starting fallback AP.");
    }
    startFallbackAccessPoint();
  }
}

void setup() {
  if (ENABLE_SERIAL_LOG) {
    Serial.begin(115200);
  }
  delay(1000);

  if (ENABLE_SERIAL_LOG) {
    Serial.println();
    Serial.println("ESP32 radio presence sensor starting...");
  }

  setupWifi();
  setupWebServer();

  BLEDevice::init("esp32-presence-sensor");
  bleScan = BLEDevice::getScan();
  bleScan->setAdvertisedDeviceCallbacks(new PresenceAdvertisedDeviceCallbacks());
  bleScan->setActiveScan(true);
  bleScan->setInterval(160);
  bleScan->setWindow(120);

  setupWifiSensing();
  scanWifi();
  scanBle();
  lastBleScanMs = millis();
  updateStatusCache();
}

void loop() {
  if (apMode) {
    dnsServer.processNextRequest();
  }
  server.handleClient();

  const unsigned long now = millis();

  sendCsiStimulus();

  if (now - lastStatusCacheMs >= STATUS_CACHE_PERIOD_MS) {
    updateStatusCache();
  }

  if (now - lastBleScanMs >= BLE_SCAN_PERIOD_MS) {
    scanBle();
    lastBleScanMs = millis();
    updateStatusCache();
  }

  server.handleClient();

  if (now - lastWifiScanMs >= WIFI_SCAN_PERIOD_MS) {
    scanWifi();
    updateStatusCache();
  }

  if (ENABLE_SERIAL_LOG && now - lastReportMs >= REPORT_PERIOD_MS) {
    updatePresence();
    lastReportMs = now;
  }

  server.handleClient();
  delay(5);
}
