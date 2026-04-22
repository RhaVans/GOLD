# How to Connect

## Overview

GOLD is a local server that mirrors your Antigravity IDE sessions to any device. It connects via Chrome DevTools Protocol (CDP) and serves a web dashboard.

## Prerequisites

- Antigravity IDE installed
- Node.js >= 18
- Both devices on the same network (for local mode), or `cloudflared` installed (for web mode)

## Step 1: Start Antigravity in Debug Mode

```bash
antigravity . --remote-debugging-port=9000
```

Or use the launcher script:
```bash
launch_antigravity_debug.bat
```

Open or start a chat in Antigravity before proceeding.

## Step 2: Start the GOLD Server

### Local Mode (LAN only)
```bash
node server.js
```

### Web Mode (remote access via Cloudflare Tunnel)
```bash
python launcher.py --mode web
```

Or use the launcher:
```bash
start_ag_phone_connect_web.bat
```

## Step 3: Connect Your Device

Open the URL displayed in the terminal on your phone or any browser:
- Local: `http://<your-lan-ip>:3000`
- Web: The Cloudflare Tunnel URL displayed in the terminal (e.g. `https://xxxx.trycloudflare.com`)

## Authentication

- **Local network**: No password required (auto-bypassed for LAN devices)
- **Remote/Cloudflare**: Enter the password set in your `.env` file (`APP_PASSWORD`)
- **Magic link**: If using web mode, scan the QR code for instant login

## Troubleshooting

| Issue | Fix |
| :--- | :--- |
| "CDP not found" | Make sure Antigravity is running with `--remote-debugging-port=9000` and a chat is open |
| Blank snapshot | Open or start a conversation in Antigravity |
| Port 3000 in use | Server auto-kills existing processes; if it fails, manually kill the process |
| Cannot connect from phone | Verify both devices are on the same Wi-Fi network |
