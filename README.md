# Graywolf 7" Tablet Web Messaging Client & Beacon Trigger

A touch-first, tactical web client engineered specifically for **7" tablet screens** (1024×600, 1280×800, 800×480) to interface directly with the [Graywolf APRS](https://chrissnell.com/software/graywolf/api.html) daemon.

Designed for vehicle dashes, radio Go-Kits, emcomm field stations, and Raspberry Pi touchscreen setups.

---

## Key Features

1. **Optimized for 7" Tablet Screens**:
   - **Tactical Dark UI**: High-contrast, night-vision-friendly dark theme (`#080c14` background with sky blue and amber accents).
   - **Touch Hitboxes**: All action buttons, chips, and toggles are sized ≥ 46–48px for easy finger tapping even with gloves or in moving vehicles.
   - **Dual-Pane Layout**: Landscape split-screen with quick-scrolling conversation list (left) and active thread feed (right). Gracefully collapses to a slide-out drawer on portrait or narrow screens.
   - **APRS Character Meter**: Live character countdown with visual warnings when exceeding standard 67-character limits up to 200 characters.
   - **Canned Responses Bar**: One-tap quick response chips (`ROGER`, `QSL`, `73`, `EN ROUTE`, `AT LOCATION`, `STANDBY`, `YES`, `NO`, `SAY AGAIN?`).
   - **Real-Time Updates**: Listens to Server-Sent Events (SSE) on `/api/messages/events` for instant notification of incoming APRS frames and delivery ACKs.
   - **Audio & Haptic Feedback**: Dual-tone synthesized audio beeps and vibration feedback on message transmit, incoming message, and beacon transmission.

2. **Manual Beacon Trigger (`POST /api/beacons/{id}/send`)**:
   - **Dedicated Header Button**: A prominent `[📡 BEACON NOW]` button is always visible in the top tactical bar.
   - **Safety Cooldown Lockout**: Configurable cooldown period (3s to 60s, default 5s) preventing accidental rapid double-keying on RF channels.
   - **Preconfigured Beacon Selector**: Tap the gear icon next to the beacon button to choose which configured beacon (from `GET /api/beacons`) is bound to the quick trigger.
   - **Manual Beacon Modal**: Lists all configured beacons with their coordinates, channels, comments, and individual "TX NOW" buttons.

3. **Zero-Dependency Architecture**:
   - Native Node.js HTTP server (`server.mjs`) with zero external `npm` dependencies.
   - Transparent reverse-proxy forwarding `/api/*` to the Graywolf daemon, handling cookies and streaming SSE without CORS issues.
   - Built-in **Mock Simulator Mode** for offline demonstration, interface testing, and development without an active radio TNC.

---

## Quick Start

### 1. Run in Mock / Field Demo Mode
Simulates a live Graywolf daemon with realistic APRS conversations, automated ACKs, and beacon transmissions:

```bash
cd graywolf-tablet-client
node server.mjs --mock --port 3000
```
Open your browser at `http://localhost:3000`.

### 2. Connect to a Live Graywolf Daemon
You can pass your Graywolf server IP/host directly on the command line or via `GRAYWOLF_URL`:

```bash
cd graywolf-tablet-client

# Option A: Direct positional argument (IP:PORT)
node server.mjs 10.0.0.122:8080 --port 3000

# Option B: Named flag
node server.mjs --target http://10.0.0.122:8080 --port 3000

# Option C: Environment variable
GRAYWOLF_URL="http://10.0.0.122:8080" PORT=3000 node server.mjs
```

> [!NOTE]
> **Authentication Required on Live Daemons**:
> Graywolf protects all station endpoints with session authentication (`POST /api/auth/login`). When connecting to your live server, the web client will automatically detect authentication status and display a **[🔒 LOG IN]** prompt. Enter your Graywolf username and password to unlock station messaging, conversation history, and beacon triggers. You can also view or switch the target server IP anytime from the in-app Settings dialog (⚙️).

---

## Graywolf API Mapping

| Feature | HTTP Method | Endpoint | Description |
|---|---|---|---|
| **Station Info** | `GET` | `/api/station/config` | Retrieves station callsign |
| **System Status** | `GET` | `/api/status` | Runtime status, packet counters |
| **Beacons List** | `GET` | `/api/beacons` | List all configured APRS beacons |
| **Trigger Beacon** | `POST` | `/api/beacons/{id}/send` | **Manually transmits selected beacon** |
| **Conversations** | `GET` | `/api/messages/conversations` | List DM and tactical threads |
| **Thread Messages** | `GET` | `/api/messages?thread_kind=...&thread_key=...` | Retrieve messages for a thread |
| **Send Message** | `POST` | `/api/messages` | Transmit DM or tactical message |
| **Real-Time Stream** | `GET` | `/api/messages/events` | Server-Sent Events (SSE) stream |
| **Mark Read** | `POST` | `/api/messages/{id}/read` | Mark message as read |
| **Resend Message** | `POST` | `/api/messages/{id}/resend` | Re-queue message transmission |
| **Delete Thread** | `DELETE` | `/api/messages/threads/{kind}/{key}` | Remove conversation history |
| **Authentication** | `POST` | `/api/auth/login` | Session login (`graywolf_session`) |

---

## Deploying on a 7" Raspberry Pi (Kiosk Mode)

### 1. Install as a systemd service
Create `/etc/systemd/system/graywolf-tablet.service`:

```ini
[Unit]
Description=Graywolf 7" Tablet Web Client
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

### 2. Autostart Chromium in Fullscreen Kiosk Mode
In your desktop autostart configuration (`~/.config/wayfire.ini` on Wayland, or `~/.config/lxsession/LXDE-pi/autostart` on X11):

```bash
chromium-browser --noerrdialogs --disable-infobars --kiosk --incognito http://localhost:3000
```
