# Graywolf APRS Tablet Terminal & OTA Radar

A tactical, touch-first web messaging terminal and live situational awareness client designed to interface with the [Graywolf APRS](https://chrissnell.com/software/graywolf/api.html) daemon and the [APRS OTA](https://aprsota.org) On-The-Air activation network.

Optimized for **7" field tablets** (1024×600, 1280×800, 800×480), **smartphones**, **iPads**, and **widescreen laptops/desktops** in radio Go-Kits, vehicle consoles, emergency management stations, and field operations.

---

## Key Features

### 1. Two-Way APRS Messaging
* **Direct Messages & Tactical Nets**: Full conversation history, unread counters, station callsign resolution, and delivery ACK tracking.
* **Real-Time Frame Stream**: Connects to Graywolf's Server-Sent Events (SSE) `/api/messages/events` and internal fast changelog for instant message and ACK updates.
* **APRS Character Meter**: Real-time counter monitoring the 67-character APRS single-frame standard with visual warning cues up to 200 characters.
* **Audio & Haptic Feedback**: Synthesized audio chirps and touch vibration feedback on transmit and receive.

### 2. Tactical Canned Response Bar
* **Cumulative Sentence Building**: Tapping quick chips accumulates into the chat prompt with proper spacing, allowing you to quickly construct full transmissions:
  * `[QSL]`, `[73]`, `[Thx 4 the contact]`, `[from Pittsburgh]`, `[QRT]`, `[HOST]`, `[PING]`, `[CQ]`.
* Example: Tapping `[Thx 4 the contact]` followed by `[from Pittsburgh]` and `[73]` builds:
  `"Thx 4 the contact from Pittsburgh 73"`.

### 3. Manual Quick Beacon Trigger
* **Instant RF Transmission**: Dedicated `[📡 BEACON NOW]` button in the top tactical bar triggers your configured beacon via Graywolf's `POST /api/beacons/{id}/send`.
* **RF Safety Cooldown Lockout**: Configurable cooldown period (3s to 60s, default 5s) preventing accidental rapid double-keying on RF channels.
* **Beacon Selector**: Easily select which configured beacon (from `GET /api/beacons`) is bound to the top quick-trigger button, or inspect beacon coordinates and channels in the configuration modal.

### 4. APRS OTA Live Spots & Radar (Chaser Mode)
* **Real-Time Activations**: Pulls active POTA (Parks on the Air) and SOTA (Summits on the Air) activations from `https://aprsota.org/api/v1/now`.
* **Polite 60-Second In-Memory Caching**: Respects APRS OTA API rate limits with automatic `ETag` and `304 Not Modified` revalidation.
* **Beacon-Based Distance & Bearing**: Dynamically reads your station's GPS latitude and longitude from your active Graywolf beacon configuration to compute great-circle distance (miles) and 16-point cardinal compass bearings (e.g. `24 mi · SE (135°)`).
* **1-Tap Chase**: Tapping `[⚡ 1-TAP CHASE]` on any active activator:
  1. Opens or switches to the conversation thread with the **`APRSOTA`** bot (or `OTA`).
  2. Pre-populates the prompt with `@<CALLSIGN> `.
  3. On phones and tablets, automatically slides the drawer shut and focuses the input, ready for you to add your report or tap canned chips and transmit over RF.

### 5. Cross-Platform Responsive Design
* **Smartphones (<640px)**: Compact top-bar badge (`🛰️ 5`), full-screen slide-out drawer with segmented `[💬 CHATS]` / `[🛰️ SPOTS]` thumb tabs, and automatic auto-collapse on chase.
* **7" Field Tablets & iPads**: High-contrast, night-vision-friendly dark theme (`#080c14`), touch hitboxes ≥ 46–48px for easy finger tapping with gloves or in moving vehicles.
* **Laptops & Desktops (≥1200px)**: 3-column console layout featuring a collapsible right-hand Live Radar panel to monitor spots alongside your active conversation and message feed.

### 6. Zero External Dependencies
* Pure Node.js standard library (`http`, `https`, `fs`, `path`) without any external `npm` dependencies.
* Reverse-proxies `/api/*` to the Graywolf daemon, handles cookie sessions without CORS issues, and proxies `/api/ota/*` to `aprsota.org`.
* Built-in **Simulated Mock Mode** for offline demonstration and testing without an active radio TNC or internet connection.

---

## Quick Start

### Prerequisites
* [Node.js](https://nodejs.org) v18.0.0 or higher.

### 1. Run Connected to a Live Graywolf Daemon
Pass your Graywolf server IP/host directly on the command line or via environment variable:

```bash
# Direct positional argument (IP:PORT)
node server.mjs 10.0.0.122:8080 --port 3000

# Or using named flag
node server.mjs --target http://10.0.0.122:8080 --port 3000

# Or via environment variable
GRAYWOLF_URL="http://10.0.0.122:8080" PORT=3000 node server.mjs
```

Open your browser at `http://localhost:3000` (or `http://<device-ip>:3000` from your phone/tablet on your local LAN).

> [!NOTE]
> **Station Authentication**:
> Graywolf protects station endpoints with session authentication (`POST /api/auth/login`). When connecting to a live server, the web client will detect authentication status and display a **[🔒 LOG IN]** prompt. Enter your Graywolf username and password to unlock messaging and beacon controls.

### 2. Run in Offline / Simulated Mock Mode
Simulates a live Graywolf station with realistic packet counters, incoming APRS threads, automated ACKs, and local PA/Pittsburgh POTA/SOTA spots:

```bash
node server.mjs --mock --port 3000
```

### 3. Run with Docker / Docker Compose (Raspberry Pi & Linux)
The application includes a lightweight multi-arch Alpine container (< 30 MB runtime RAM) optimized for Raspberry Pi 4/5 (ARM64) and x86_64:

```bash
# Ensure config file exists on host for persistent volume mount
touch config.json

# Build and start in the background
docker compose up -d
```

Or using standalone `docker run`:
```bash
# Connected to local Graywolf daemon via host networking (Linux / Pi)
docker run -d \
  --name graywolf-tablet \
  --restart unless-stopped \
  --network host \
  -e GRAYWOLF_URL="http://127.0.0.1:8080" \
  -v "$(pwd)/config.json:/app/config.json" \
  graywolf-tablet-client

# Or run in bridge mode pointing to a remote Graywolf IP
docker run -d \
  --name graywolf-tablet \
  --restart unless-stopped \
  -p 3000:3000 \
  -e GRAYWOLF_URL="http://10.0.0.122:8080" \
  -v "$(pwd)/config.json:/app/config.json" \
  graywolf-tablet-client

# Or run in Simulated Mock Mode
docker run -d \
  --name graywolf-tablet \
  -p 3000:3000 \
  -e MOCK=true \
  graywolf-tablet-client
```

---

## Configuration & APRS OTA API

1. Open the in-app **Settings dialog (⚙️)** in the top bar.
2. Scroll to **🛰️ APRS OTA Integration**:
   * **Bearer Token**: Enter your free non-commercial API token from Jared K0TFU (see [aprsota.org/handbook/api](https://aprsota.org/handbook/api)). If left blank, simulated mock spots are used for preview.
   * **Bot Callsign Target**: Set to `APRSOTA` (default) or regional gateway (e.g. `OTA`).
3. Settings are saved locally to `config.json` on the server and are automatically excluded from git tracking.

A template configuration file is provided in [`config.example.json`](config.example.json):
```json
{
  "aprsota_token": "aprsota_example_token_here_32_chars",
  "bot_callsign": "APRSOTA"
}
```

---

## Source Code Management & GitHub

To link this repository to your personal GitHub account:

1. Create a new repository on [GitHub](https://github.com/new) (e.g. `graywolf-tablet-client`), either **Private** or **Public**.
2. Add your GitHub remote and push:
   ```bash
   git remote add origin https://github.com/<your-username>/graywolf-tablet-client.git
   git branch -M main
   git push -u origin main --tags
   ```

### Rolling Back to Previous Releases
A baseline release tag is preserved:
```bash
# Return to original pre-APRSOTA baseline
git checkout v1.0.0-stable
```

---

## Automated Verification & Testing

Run the comprehensive 28-suite end-to-end test suite:

```bash
node test-e2e.mjs
```

Tests verify:
* Positional argument parsing and `/client/info`
* Station configuration and beacon retrieval
* Manual beacon triggering (`POST /api/beacons/{id}/send`)
* Conversation listing and thread retrieval
* Message transmission and ACK tracking
* Static asset delivery and APRS OTA DOM markup
* Live APRS OTA spots feed (`/api/ota/now`)
* Polite 60-second upstream caching (`X-Cache: HIT`)
* Dynamic configuration updates (`POST /client/ota-config`)
* Great-circle Haversine distance and forward azimuth bearing math
* Host / Activation Assistant HUD lifecycle, anti-flapping grace period, and pileup queue
* 1-Tap Chase worked state tracking and auto-refresh on new OP transitions
* Chaser flow isolation vs host state machine and bot prompt disambiguation
* Chaser pileup confirmation, 1-tap QSL drafting, and bot DE relay parsing
* Host reply to chaser isolation (preventing host pileup QSLs from marking chaser spots as worked) and Shift+Click unmark support
* 1-Tap Chase armed prompt state vs actual RF transmission lifecycle
* Spot card SSID key normalization (`K3NG-7:42` vs `K3NG:42`) and multi-op search accuracy
* Direct DMs to activators and casual chat mention filtering
* Inbound chaser QSL relays, HUD score increments, and flexible relay parsing (`DE CALL`, `DE CALL: 599`)
* Host reply resiliency (`TU @CALL 599`) and auto-logging chasers without literal "QSL"
* On-air chaser pileup queue reconstruction across browser refreshes

---

## Deploying on a Raspberry Pi (Kiosk Mode)

### Option A: Docker Compose (Recommended for Raspberry Pi 4 & 5)

Using Docker isolates the runtime and automatically handles restart-on-boot:

1. **Install Docker** on Raspberry Pi OS (if not already installed):
   ```bash
   curl -sSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```
   *(Log out and back in for group changes to take effect).*

2. **Start the Container**:
   ```bash
   cd ~/graywolf-tablet-client
   touch config.json
   docker compose up -d
   ```
   The container runs using `network_mode: host` to communicate directly with Graywolf on `127.0.0.1:8080`, with auto-restart on system reboot (`restart: unless-stopped`).

### Option B: Native Systemd Service
Create `/etc/systemd/system/graywolf-tablet.service`:

```ini
[Unit]
Description=Graywolf APRS Tablet Web Client
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/graywolf-tablet-client
Environment=GRAYWOLF_URL=http://127.0.0.1:8080
Environment=PORT=3000
ExecStart=/usr/bin/node server.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now graywolf-tablet.service
```

### Autostart Chromium in Fullscreen Kiosk Mode
In your desktop autostart configuration (`~/.config/wayfire.ini` on Wayland or `~/.config/lxsession/LXDE-pi/autostart` on X11):

```bash
chromium-browser --noerrdialogs --disable-infobars --kiosk --incognito http://localhost:3000
```

---

## Acknowledgments & Credits

* **[Graywolf APRS](https://chrissnell.com/software/graywolf/api.html)** by Chris Snell.
* **[APRS OTA](https://aprsota.org)** by Jared K0TFU.
