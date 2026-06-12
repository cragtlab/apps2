# ESP32 Radio Presence Sensor

This Arduino sketch estimates whether people are in a room using only the ESP32 built-in radios, and serves a small browser dashboard.

## How It Works

- Bluetooth LE scan: counts nearby advertising devices such as phones, watches, earbuds, tags, and laptops.
- Wi-Fi CSI test: watches router-to-ESP32 channel changes and turns them into a simple motion score.
- Passive Wi-Fi sensing: counts nearby client-like Wi-Fi transmitters, such as phones and laptops sending probe or data frames.
- Wi-Fi scan: counts strong nearby access points as a weak secondary signal.
- Browser dashboard: shows live presence status.
- Cached browser output: the web endpoint serves the latest cached status instead of recalculating during each browser request.

This is not an exact people counter. Phones may randomize addresses, stop advertising, or be left in the room without a person. Wi-Fi sensing only sees devices when they transmit on the channel the ESP32 is listening to. Treat the result as a presence/trend signal.

## Upload

1. Open `esp32sensor.ino` in Arduino IDE.
2. Optional: set `WIFI_SSID` and `WIFI_PASSWORD` near the top of the sketch.
3. Select an ESP32 board, for example `ESP32 Dev Module`.
4. Upload and open the browser dashboard.

Serial output is off by default. Set `ENABLE_SERIAL_LOG` to `true` only when debugging.

## Browser Access

Best option: set your router Wi-Fi details in the sketch, upload, then open:

```text
http://esp32sensor.local/
```

That uses mDNS, so you do not need to know the ESP32 IP address. It usually works on macOS, iOS, Linux, and Windows 10/11. If Windows does not resolve `.local`, install/use Bonjour support, check your router's client list, or temporarily set `ENABLE_SERIAL_LOG` to `true` to print the IP.

Fallback option: leave `WIFI_SSID` blank or let the router connection fail. The ESP32 creates this Wi-Fi network:

```text
Network: ESP32-Presence
Password: presence123
```

After connecting to that network, open:

```text
http://192.168.4.1/
```

The sketch also runs captive DNS in fallback mode, so many devices will automatically show the page or let a random browser address land on the ESP32.

## Tuning

Change these constants near the top of `esp32sensor.ino`:

- `BLE_NEAR_RSSI`: raise toward `-70` to count only closer devices; lower toward `-90` to count farther devices.
- `ENABLE_CSI_TEST`: turns the router CSI experiment on or off.
- `CSI_MOTION_THRESHOLD`: lower it if motion does not trigger; raise it if the room looks occupied when empty.
- `CSI_BASELINE_LEARN_MS`: empty-room learning time after boot or after pressing `Reset CSI baseline`.
- `CSI_STIMULUS_PERIOD_MS`: how often the ESP32 sends a tiny DNS query to the router to encourage CSI packets.
- `BLE_SCAN_SECONDS`: BLE scan duration. Larger values improve sensing but make the browser less responsive.
- `BLE_SCAN_PERIOD_MS`: how often BLE scans run.
- `STATUS_CACHE_PERIOD_MS`: how often the browser status cache refreshes.
- `WIFI_CLIENT_NEAR_RSSI`: raise toward `-65` to count only closer Wi-Fi devices; lower toward `-90` to count farther devices.
- `DEVICE_TTL_MS`: how long a BLE device still counts after it disappears.
- `PRESENCE_ON_SCORE` and `PRESENCE_OFF_SCORE`: presence sensitivity and hysteresis.
- `ENABLE_SERIAL_LOG`: set to `true` only when debugging; normal browser mode keeps Serial output quiet.

For most rooms, tune `BLE_NEAR_RSSI` and `WIFI_CLIENT_NEAR_RSSI` first.

## Wi-Fi Sensing Notes

The sketch uses passive Wi-Fi metadata only. It does not decrypt traffic, read payload contents, print MAC addresses, or save device IDs. It hashes transmitter addresses in RAM so repeated packets from the same nearby device can be counted for a short time.

For reliable browser access, the ESP32 stays on one Wi-Fi channel. That means passive Wi-Fi sensing is strongest for devices using the same channel as your router or the ESP32 fallback access point. BLE still helps cover devices that are quiet on Wi-Fi.

## CSI Test

CSI sensing needs the ESP32 connected to your router Wi-Fi. It is not useful in fallback AP-only mode.

To try it:

1. Put the ESP32 somewhere fixed. Do not move it during the test.
2. Open `http://esp32sensor.local/`.
3. Leave the room empty for about 30 seconds while `CSI status` says `learning`.
4. Press `Reset CSI baseline` after the room is empty if you want a fresh baseline.
5. Walk through the room or sit between the router and ESP32.
6. Watch `CSI motion`, `CSI packets`, and `CSI status`.

Good signs:

- `CSI packets` increases steadily.
- `CSI status` changes from `learning` to `quiet`.
- `CSI motion` jumps when someone moves in the room.

If `CSI status` stays `no packets`, your router may not answer the DNS stimulus from the ESP32. The browser may still create some CSI traffic while open, but router CSI will be weak. In that case, keep the dashboard open and try moving between your browser device/router and the ESP32, or switch later to Espressif's full ESP-CSI test app.
