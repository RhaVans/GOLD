# GOLD - Global Operator Link Developer

Remote mobile interface for Antigravity IDE workspaces. Connects to running Antigravity instances via Chrome DevTools Protocol (CDP) and exposes a Bloomberg Terminal-inspired web dashboard for monitoring and controlling active coding sessions from any device.

## Architecture

```
Mobile Browser <---> GOLD Server (Node.js/Express) <---> Antigravity IDE (CDP)
                     |                                    |
                     +--> WebSocket (live sync)           +--> Chrome DevTools Protocol
                     +--> REST API (commands)              +--> Runtime.evaluate()
                     +--> ngrok (remote access)
```

## Features

- **Live Snapshot Sync** - Real-time HTML capture of the Antigravity chat interface via CDP, streamed to the mobile client over WebSocket
- **Multi-Workspace Support** - Auto-discovers and manages multiple concurrent Antigravity instances across debug ports 9000-9003
- **Remote Commands** - Send messages, switch modes (Fast/Planning), change models, stop generation, start new chats, and navigate history
- **Media Upload** - Attach files from mobile devices; uploaded to server and file paths are injected into the chat input
- **Dark Terminal UI** - High-density Bloomberg-style interface with IBM Plex Mono typography, optimized for both desktop and mobile viewports
- **Authentication** - Cookie-based auth with support for magic link / QR code auto-login
- **ngrok Integration** - Built-in tunnel support for secure remote access over the internet

## Requirements

- Node.js >= 18
- Python 3.x (for launcher scripts)
- Antigravity IDE running with `--remote-debugging-port` enabled (ports 9000-9003)

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set APP_PASSWORD

# Start server (local mode)
node server.js

# Start server (web mode with ngrok)
node server.js --mode web
```

See [HOW_TO_CONNECT.md](HOW_TO_CONNECT.md) for detailed connection instructions.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PASSWORD` | `antigravity` | Authentication password |
| `PORT` | `3000` | Server port |
| `NGROK_AUTH_TOKEN` | - | ngrok authentication token (required for web mode) |

## Project Structure

```
server.js              # Express server, CDP manager, REST API, WebSocket
ui_inspector.js        # CDP-based UI element inspector
public/
  index.html           # Main dashboard (GOLD interface)
  login.html           # Authentication page
  css/style.css        # Terminal-style design system
  js/app.js            # Client-side logic, snapshot rendering, tools
bridge_connector.bat   # Cross-workspace launcher (Windows)
start_ag_phone_connect_web.bat  # Web mode launcher
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

MIT
