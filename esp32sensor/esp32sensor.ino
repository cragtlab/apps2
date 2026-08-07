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
#include <esp_task_wdt.h>
#include <math.h>

// Put your router Wi-Fi here for http://esp32sensor.local/.
// Leave WIFI_SSID blank to use fallback access-point mode only.
static const char *WIFI_SSID = "SilverGate";
static const char *WIFI_PASSWORD = "OneSG!Advance#26";
static const char *MDNS_NAME = "esp32sensor";

// Fallback direct ESP32 Wi-Fi. Connect to this network if router mode is off
// or cannot connect, then browse to http://192.168.4.1/.
static const char *AP_SSID = "ESP32-Presence";
static const char *AP_PASSWORD = "presence123";  // At least 8 chars.

// Tune these for your room.
static const bool ENABLE_SERIAL_LOG = true;
static const bool ENABLE_HEAP_LOG = true;
static const bool ENABLE_CSI_TEST = true;
static const int BLE_SCAN_SECONDS = 1;
static const int BLE_SCAN_PERIOD_MS = 5000;
static const int WIFI_SCAN_PERIOD_MS = 30000;
static const int CSI_STIMULUS_PERIOD_MS = 1000;
static const int CSI_BASELINE_LEARN_MS = 30000;
static const int CSI_MOTION_THRESHOLD = 18;
static const int CSI_VARIANCE_WINDOW = 20;
static const int CSI_VARIANCE_THRESHOLD = 10;
static const int STATUS_CACHE_PERIOD_MS = 1000;
static const int REPORT_PERIOD_MS = 10000;
static const int HEAP_LOG_PERIOD_MS = 10000;
static const int BLE_NEAR_RSSI = -82;       // Closer to 0 means nearer.
static const int WIFI_CLIENT_NEAR_RSSI = -78;
static const int WIFI_NEAR_RSSI = -78;
static const int DEVICE_TTL_MS = 90000;     // Forget devices not seen recently.
static const int MAX_TRACKED_DEVICES = 80;
static const int OCCUPIED_CONFIRM_MS = 15000;
static const int VACANT_CONFIRM_MS = 300000;
static const int BASELINE_SAMPLE_PERIOD_MS = 60000;
static const int BASELINE_SAMPLE_COUNT = 60;
static const int BASELINE_QUIET_MS = 120000;

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
unsigned long lastHeapLogMs = 0;
unsigned long lastBaselineSampleMs = 0;
unsigned long lastMotionSignalMs = 0;
unsigned long lastStrongPresenceMs = 0;
unsigned long pendingOccupiedSinceMs = 0;
unsigned long pendingVacantSinceMs = 0;
int lastWifiNearCount = 0;
int lastWifiClientNearCount = 0;
int lastWifiClientTotalCount = 0;
int lastBleNearCount = 0;
int lastBleTotalCount = 0;
int lastCsiMotionScore = 0;
int lastCsiVarianceScore = 0;
int lastCsiPacketCount = 0;
int lastCsiRssi = 0;
int lastScore = 0;
int baselineBleNear = 0;
int baselineWifiClientNear = 0;
int baselineWifiApNear = 0;
int baselineSampleTotal = 0;
int baselineSampleIndex = 0;
int lastDeviceExtraCount = 0;
bool roomOccupied = false;
bool apMode = false;
bool mdnsStarted = false;
bool lastCsiReady = false;
bool lastCsiPresence = false;
bool lastMotionSignal = false;
bool lastDeviceSignal = false;
bool lastStrongDeviceSignal = false;
char statusCacheJson[1536] = "{}";

int baselineBleSamples[BASELINE_SAMPLE_COUNT];
int baselineWifiClientSamples[BASELINE_SAMPLE_COUNT];
int baselineWifiApSamples[BASELINE_SAMPLE_COUNT];

portMUX_TYPE csiMux = portMUX_INITIALIZER_UNLOCKED;
float csiBaseline = 0.0f;
float csiMotionScore = 0.0f;
float csiVarianceScore = 0.0f;
float csiAmplitudeWindow[CSI_VARIANCE_WINDOW];
volatile uint32_t csiPacketCount = 0;
unsigned long csiStartedAtMs = 0;
unsigned long lastCsiPacketMs = 0;
int csiLastRssi = 0;
int csiAmplitudeCount = 0;
int csiAmplitudeIndex = 0;
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
      <div class="metric"><span class="label">Device baseline</span><span id="deviceBaseline" class="value">...</span></div>
      <div class="metric"><span class="label">Device signal</span><span id="deviceSignal" class="value">...</span></div>
      <div class="metric"><span class="label">CSI status</span><span id="csiStatus" class="value">...</span></div>
      <div class="metric"><span class="label">CSI motion</span><span id="csiMotion" class="value">...</span></div>
      <div class="metric"><span class="label">CSI variance</span><span id="csiVariance" class="value">...</span></div>
      <div class="metric"><span class="label">CSI packets</span><span id="csiPackets" class="value">...</span></div>
      <div class="metric"><span class="label">CSI RSSI</span><span id="csiRssi" class="value">...</span></div>
      <div class="metric"><span class="label">Transition</span><span id="transitionState" class="value">...</span></div>
      <div class="metric"><span class="label">Vacant timer</span><span id="vacantTimer" class="value">...</span></div>
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
      deviceBaseline.textContent = 'BLE ' + data.baseline_ble_near + ' / Wi-Fi ' + data.baseline_wifi_clients_near;
      deviceSignal.textContent = data.device_signal;
      csiStatus.textContent = data.csi_status;
      csiMotion.textContent = data.csi_motion;
      csiVariance.textContent = data.csi_variance;
      csiPackets.textContent = data.csi_packets;
      csiRssi.textContent = data.csi_rssi;
      transitionState.textContent = data.transition_state;
      vacantTimer.textContent = data.vacant_seconds_remaining + 's';
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

void feedWatchdog() {
  esp_task_wdt_reset();
  yield();
}

int medianBaseline(const int samples[], int count) {
  if (count <= 0) {
    return 0;
  }

  int sorted[BASELINE_SAMPLE_COUNT];
  for (int i = 0; i < count; i++) {
    sorted[i] = samples[i];
  }

  for (int i = 1; i < count; i++) {
    const int value = sorted[i];
    int j = i - 1;
    while (j >= 0 && sorted[j] > value) {
      sorted[j + 1] = sorted[j];
      j--;
    }
    sorted[j + 1] = value;
  }

  return sorted[count / 2];
}

const char *deviceSignalLabel() {
  if (lastStrongDeviceSignal) {
    return "strong";
  }
  if (lastDeviceSignal) {
    return "weak";
  }
  return "quiet";
}

const char *transitionStateLabel() {
  if (roomOccupied && pendingVacantSinceMs > 0) {
    return "vacant pending";
  }
  if (!roomOccupied && pendingOccupiedSinceMs > 0) {
    return "occupied pending";
  }
  return roomOccupied ? "stable occupied" : "stable vacant";
}

int vacantSecondsRemaining() {
  if (!roomOccupied || pendingVacantSinceMs == 0) {
    return 0;
  }

  const unsigned long elapsed = millis() - pendingVacantSinceMs;
  if (elapsed >= VACANT_CONFIRM_MS) {
    return 0;
  }
  return static_cast<int>((VACANT_CONFIRM_MS - elapsed + 999) / 1000);
}

void calculateDeviceSignal() {
  const int bleExtra = max(0, lastBleNearCount - baselineBleNear);
  const int wifiExtra = max(0, lastWifiClientNearCount - baselineWifiClientNear);
  lastDeviceExtraCount = bleExtra + wifiExtra;

  if (baselineSampleTotal == 0) {
    lastDeviceSignal = lastBleNearCount > 0 || lastWifiClientNearCount > 0;
    lastStrongDeviceSignal = lastBleNearCount + lastWifiClientNearCount >= 2;
    return;
  }

  const bool bleActive = lastBleNearCount >= baselineBleNear + 1;
  const bool wifiActive = lastWifiClientNearCount >= baselineWifiClientNear + 1;

  lastDeviceSignal = bleActive || wifiActive;
  lastStrongDeviceSignal = bleActive || wifiActive || lastDeviceExtraCount >= 2;
}

void recordBaselineSampleIfQuiet() {
  const unsigned long now = millis();
  if (now - lastBaselineSampleMs < BASELINE_SAMPLE_PERIOD_MS) {
    return;
  }
  lastBaselineSampleMs = now;

  const bool csiQuietLongEnough = lastCsiReady && lastMotionSignalMs > 0 && now - lastMotionSignalMs >= BASELINE_QUIET_MS;
  if (roomOccupied || !csiQuietLongEnough || lastMotionSignal) {
    return;
  }

  baselineBleSamples[baselineSampleIndex] = lastBleNearCount;
  baselineWifiClientSamples[baselineSampleIndex] = lastWifiClientNearCount;
  baselineWifiApSamples[baselineSampleIndex] = lastWifiNearCount;

  baselineSampleIndex = (baselineSampleIndex + 1) % BASELINE_SAMPLE_COUNT;
  if (baselineSampleTotal < BASELINE_SAMPLE_COUNT) {
    baselineSampleTotal++;
  }

  baselineBleNear = medianBaseline(baselineBleSamples, baselineSampleTotal);
  baselineWifiClientNear = medianBaseline(baselineWifiClientSamples, baselineSampleTotal);
  baselineWifiApNear = medianBaseline(baselineWifiApSamples, baselineSampleTotal);
}

float updateCsiVariance(float amplitude) {
  csiAmplitudeWindow[csiAmplitudeIndex] = amplitude;
  csiAmplitudeIndex = (csiAmplitudeIndex + 1) % CSI_VARIANCE_WINDOW;
  if (csiAmplitudeCount < CSI_VARIANCE_WINDOW) {
    csiAmplitudeCount++;
  }

  if (csiAmplitudeCount < 2) {
    return 0.0f;
  }

  float mean = 0.0f;
  for (int i = 0; i < csiAmplitudeCount; i++) {
    mean += csiAmplitudeWindow[i];
  }
  mean /= static_cast<float>(csiAmplitudeCount);

  float variance = 0.0f;
  for (int i = 0; i < csiAmplitudeCount; i++) {
    const float delta = csiAmplitudeWindow[i] - mean;
    variance += delta * delta;
  }
  variance /= static_cast<float>(csiAmplitudeCount - 1);
  return sqrtf(variance);
}

void updatePresenceStateMachine() {
  const unsigned long now = millis();
  const bool occupiedIntent = lastMotionSignal || lastStrongDeviceSignal;
  const bool quietIntent = !lastMotionSignal && !lastDeviceSignal;

  if (occupiedIntent) {
    lastStrongPresenceMs = now;
    pendingVacantSinceMs = 0;

    if (!roomOccupied) {
      if (pendingOccupiedSinceMs == 0) {
        pendingOccupiedSinceMs = now;
      }
      if (now - pendingOccupiedSinceMs >= OCCUPIED_CONFIRM_MS) {
        roomOccupied = true;
        pendingOccupiedSinceMs = 0;
      }
    } else {
      pendingOccupiedSinceMs = 0;
    }
  } else {
    pendingOccupiedSinceMs = 0;
  }

  if (roomOccupied) {
    if (quietIntent) {
      if (pendingVacantSinceMs == 0) {
        pendingVacantSinceMs = now;
      }
      if (now - pendingVacantSinceMs >= VACANT_CONFIRM_MS) {
        roomOccupied = false;
        pendingVacantSinceMs = 0;
      }
    } else {
      pendingVacantSinceMs = 0;
    }
  }
}

void resetCsiBaseline() {
  portENTER_CRITICAL(&csiMux);
  csiBaseline = 0.0f;
  csiMotionScore = 0.0f;
  csiVarianceScore = 0.0f;
  csiPacketCount = 0;
  csiStartedAtMs = millis();
  lastCsiPacketMs = 0;
  csiLastRssi = 0;
  csiAmplitudeCount = 0;
  csiAmplitudeIndex = 0;
  csiBaselineReady = false;
  portEXIT_CRITICAL(&csiMux);
  lastMotionSignalMs = millis();
}

void updateCsiSnapshot() {
  portENTER_CRITICAL(&csiMux);
  const uint32_t packets = csiPacketCount;
  const float motion = csiMotionScore;
  const float variance = csiVarianceScore;
  const bool ready = csiBaselineReady;
  const unsigned long packetMs = lastCsiPacketMs;
  const int rssi = csiLastRssi;
  portEXIT_CRITICAL(&csiMux);

  lastCsiPacketCount = packets > 999999 ? 999999 : static_cast<int>(packets);
  lastCsiMotionScore = static_cast<int>(motion + 0.5f);
  lastCsiVarianceScore = static_cast<int>(variance + 0.5f);
  lastCsiReady = ready;
  lastCsiRssi = rssi;
  lastMotionSignal = ready && millis() - packetMs < 10000 &&
      (lastCsiMotionScore >= CSI_MOTION_THRESHOLD || lastCsiVarianceScore >= CSI_VARIANCE_THRESHOLD);
  lastCsiPresence = lastMotionSignal;
  if (lastMotionSignal) {
    lastMotionSignalMs = millis();
  }
}

const char *csiStatusLabel() {
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
  csiVarianceScore = updateCsiVariance(amplitude);

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
    BLEAddress address = advertisedDevice.getAddress();
    const uint8_t *addressBytes = reinterpret_cast<const uint8_t *>(address.getNative());
    const uint32_t hash = fnv1aHashBytes(addressBytes, 6);
    rememberBleDevice(hash, rssi);
  }
};

void scanBle() {
  feedWatchdog();
  bleScan->start(BLE_SCAN_SECONDS, false);
  feedWatchdog();
  bleScan->clearResults();
  countBleDevices(lastBleTotalCount, lastBleNearCount);
  feedWatchdog();
}

void scanWifi() {
  feedWatchdog();
  esp_wifi_set_promiscuous(false);
  const int networkCount = WiFi.scanNetworks(false, true);
  feedWatchdog();
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
  feedWatchdog();
}

const char *presenceLabel(int score) {
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
  calculateDeviceSignal();

  lastScore = 0;
  lastScore += max(0, lastBleNearCount - baselineBleNear) * 2;
  lastScore += max(0, lastWifiClientNearCount - baselineWifiClientNear) * 2;
  lastScore += lastDeviceExtraCount;

  if (lastMotionSignal) {
    lastScore += 3;
  } else if (lastCsiReady && lastCsiMotionScore >= CSI_MOTION_THRESHOLD / 2) {
    lastScore += 1;
  }

  // Wi-Fi APs are not people, but a changed/strong radio environment can help
  // avoid flicker when BLE devices briefly sleep.
  if (lastWifiNearCount >= 3) {
    lastScore += 1;
  }

  updatePresenceStateMachine();
  recordBaselineSampleIfQuiet();
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
    Serial.print(" device_signal=");
    Serial.print(deviceSignalLabel());
    Serial.print(" baseline_ble=");
    Serial.print(baselineBleNear);
    Serial.print(" baseline_wifi_clients=");
    Serial.print(baselineWifiClientNear);
    Serial.print(" csi_status=");
    Serial.print(csiStatusLabel());
    Serial.print(" csi_motion=");
    Serial.print(lastCsiMotionScore);
    Serial.print(" csi_variance=");
    Serial.print(lastCsiVarianceScore);
    Serial.print(" csi_packets=");
    Serial.print(lastCsiPacketCount);
    Serial.print(" transition=");
    Serial.print(transitionStateLabel());
    Serial.print(" vacant_timer=");
    Serial.print(vacantSecondsRemaining());
    Serial.print(" wifi_aps_near=");
    Serial.print(lastWifiNearCount);
    Serial.println();
  }
}

void writeNetworkSummary(char *buffer, size_t bufferSize) {
  if (WiFi.status() == WL_CONNECTED) {
    const IPAddress ip = WiFi.localIP();
    snprintf(
      buffer,
      bufferSize,
      "Open http://%s.local/ or http://%u.%u.%u.%u/",
      MDNS_NAME,
      static_cast<unsigned>(ip[0]),
      static_cast<unsigned>(ip[1]),
      static_cast<unsigned>(ip[2]),
      static_cast<unsigned>(ip[3])
    );
    return;
  }
  if (apMode) {
    snprintf(
      buffer,
      bufferSize,
      "Connected to fallback Wi-Fi %s. Open http://192.168.4.1/.",
      AP_SSID
    );
    return;
  }
  snprintf(buffer, bufferSize, "Wi-Fi is starting...");
}

unsigned long lastStrongPresenceAgeMs() {
  if (lastStrongPresenceMs == 0) {
    return 0;
  }
  return millis() - lastStrongPresenceMs;
}

void buildStatusJson(char *buffer, size_t bufferSize) {
  calculatePresence();

  char network[128];
  writeNetworkSummary(network, sizeof(network));

  const int written = snprintf(
    buffer,
    bufferSize,
    "{\"occupied\":%s,\"level\":\"%s\",\"score\":%d,"
    "\"ble_near\":%d,\"ble_total\":%d,"
    "\"wifi_clients_near\":%d,\"wifi_clients_total\":%d,"
    "\"baseline_ble_near\":%d,\"baseline_wifi_clients_near\":%d,"
    "\"baseline_wifi_aps_near\":%d,\"baseline_samples\":%d,"
    "\"device_signal\":\"%s\",\"csi_status\":\"%s\","
    "\"csi_motion\":%d,\"csi_variance\":%d,\"csi_packets\":%d,"
    "\"csi_rssi\":%d,\"csi_presence\":%s,"
    "\"transition_state\":\"%s\",\"vacant_seconds_remaining\":%d,"
    "\"last_strong_presence_age_ms\":%lu,"
    "\"wifi_aps_near\":%d,\"uptime_ms\":%lu,\"free_heap\":%u,"
    "\"network\":\"%s\"}",
    roomOccupied ? "true" : "false",
    presenceLabel(lastScore),
    lastScore,
    lastBleNearCount,
    lastBleTotalCount,
    lastWifiClientNearCount,
    lastWifiClientTotalCount,
    baselineBleNear,
    baselineWifiClientNear,
    baselineWifiApNear,
    baselineSampleTotal,
    deviceSignalLabel(),
    csiStatusLabel(),
    lastCsiMotionScore,
    lastCsiVarianceScore,
    lastCsiPacketCount,
    lastCsiRssi,
    lastCsiPresence ? "true" : "false",
    transitionStateLabel(),
    vacantSecondsRemaining(),
    lastStrongPresenceAgeMs(),
    lastWifiNearCount,
    millis(),
    ESP.getFreeHeap(),
    network
  );

  if (written < 0 || static_cast<size_t>(written) >= bufferSize) {
    snprintf(buffer, bufferSize, "{\"error\":\"status buffer too small\",\"free_heap\":%u}", ESP.getFreeHeap());
  }
}

void updateStatusCache() {
  buildStatusJson(statusCacheJson, sizeof(statusCacheJson));
  lastStatusCacheMs = millis();

  if (ENABLE_SERIAL_LOG && ENABLE_HEAP_LOG && lastStatusCacheMs - lastHeapLogMs >= HEAP_LOG_PERIOD_MS) {
    lastHeapLogMs = lastStatusCacheMs;
    Serial.print("free_heap=");
    Serial.println(ESP.getFreeHeap());
  }
}

void handleStatus() {
  if (strcmp(statusCacheJson, "{}") == 0) {
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
  lastWifiScanMs = millis();
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

  if (now - lastWifiScanMs >= WIFI_SCAN_PERIOD_MS) {
    scanWifi();
    updateStatusCache();
  } else if (now - lastBleScanMs >= BLE_SCAN_PERIOD_MS) {
    scanBle();
    lastBleScanMs = millis();
    updateStatusCache();
  }

  server.handleClient();

  if (ENABLE_SERIAL_LOG && now - lastReportMs >= REPORT_PERIOD_MS) {
    updatePresence();
    lastReportMs = now;
  }

  server.handleClient();
  delay(5);
}
