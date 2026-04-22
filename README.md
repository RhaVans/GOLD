# GOLD - Global Operator Link Developer

Remote mobile interface for Antigravity IDE workspaces. Connects to running Antigravity instances via Chrome DevTools Protocol (CDP) and exposes a Bloomberg Terminal-inspired web dashboard for monitoring and controlling active coding sessions from any device.

## Architecture

```
Mobile Browser <---> GOLD Server (Node.js/Express) <---> Antigravity IDE (CDP)
                     |                                    |
                     +--> WebSocket (live sync)           +--> Chrome DevTools Protocol
                     +--> REST API (commands)              +--> Runtime.evaluate()
                     +--> Cloudflare Tunnel (remote)
```

## Features

- **Live Snapshot Sync** — Real-time HTML capture of the Antigravity chat interface via CDP, streamed to the mobile client over WebSocket
- **Multi-Workspace Support** — Auto-discovers and manages up to 4 concurrent Antigravity instances across debug ports 9000-9003
- **Remote Commands** — Send messages, switch modes (Fast/Planning), change models, stop generation, start new chats, and navigate history
- **Action Button Relay** — Detects Apply/Accept/Approve/Reject/Save/Discard buttons in snapshots and relays clicks back to the IDE via CDP
- **Media Upload** — Attach files from mobile devices; uploaded to server and file paths are injected into the chat input
- **Dark Terminal UI** — High-density Bloomberg-style interface with IBM Plex Mono typography, optimized for both desktop and mobile viewports
- **Authentication** — Cookie-based auth with support for magic link / QR code auto-login
- **Cloudflare Tunnel** — Free, zero-config remote access via `cloudflared` (no account required). Also supports Pinggy and ngrok as alternatives

## Requirements

- Node.js >= 18
- Python 3.x (for launcher scripts)
- Antigravity IDE running with `--remote-debugging-port` enabled (ports 9000-9003)
- `cloudflared` installed for web/remote mode ([install guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/))

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set APP_PASSWORD

# 3. Start server (local mode — LAN only)
node server.js

# 4. Start server (web mode — remote access via Cloudflare Tunnel)
python launcher.py --mode web
```

### One-Click Launch (Windows)

Launch all workspaces + the Phone Connect server in a single click:

```bash
launch_all_workspaces.bat
```

Edit the workspace paths at the top of the file (`WS1` through `WS4`) to match your projects.

See [HOW_TO_CONNECT.md](HOW_TO_CONNECT.md) for detailed connection instructions.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PASSWORD` | `antigravity` | Authentication password |
| `PORT` | `3000` | Server port |
| `TUNNEL_PROVIDER` | `cloudflare` | Tunnel provider: `cloudflare`, `pinggy`, or `ngrok` |
| `CLOUDFLARE_TUNNEL_NAME` | — | Optional: named persistent tunnel |
| `CLOUDFLARE_TUNNEL_URL` | — | Optional: custom domain for named tunnel |
| `NGROK_AUTHTOKEN` | — | ngrok auth token (only if using ngrok) |
| `PINGGY_TOKEN` | — | Pinggy token (only if using pinggy) |
| `SESSION_SECRET` | auto-generated | Secret for session cookies |
| `AUTH_SALT` | auto-generated | Salt for auth token hashing |

## Project Structure

```
server.js                       # Express server, CDP manager, REST API, WebSocket
launcher.py                     # Python launcher — starts server + tunnel
ui_inspector.js                 # CDP-based UI element inspector
public/
  index.html                    # Main dashboard (GOLD interface)
  login.html                    # Authentication page
  css/style.css                 # Terminal-style design system
  js/app.js                     # Client-side logic, snapshot rendering, tools
launch_all_workspaces.bat       # Multi-workspace launcher (up to 4 workspaces)
bridge_connector.bat            # Cross-workspace portable launcher
start_ag_phone_connect_web.bat  # Web mode launcher (Windows)
start_ag_phone_connect_web.sh   # Web mode launcher (Linux/macOS)
.env.example                    # Environment configuration template
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/snapshot` | Current chat snapshot (HTML + CSS) |
| `POST` | `/send` | Send message to Antigravity |
| `POST` | `/set-mode` | Switch Fast/Planning mode |
| `POST` | `/set-model` | Change AI model |
| `POST` | `/stop` | Stop active generation |
| `POST` | `/new-chat` | Start new conversation |
| `GET` | `/chat-history` | List recent conversations |
| `POST` | `/select-chat` | Switch to a specific conversation |
| `GET` | `/workspaces` | List discovered Antigravity instances |
| `POST` | `/switch-workspace` | Switch active workspace |
| `POST` | `/upload-media` | Upload files from mobile |
| `GET` | `/app-state` | Current mode, model, and status |
| `GET` | `/health` | Server health check |

## License

GPL-3.0-only
