# Code Documentation - GOLD

## Architecture

GOLD operates as a headless mirror of the Antigravity IDE. It connects to running Antigravity instances via Chrome DevTools Protocol (CDP) and serves a web dashboard that renders live snapshots of the IDE's chat interface.

```
Client (Browser) <---> Express Server <---> CDP WebSocket <---> Antigravity IDE
```

## Core Modules (server.js)

### CDP Connection Layer

| Function | Description |
| :--- | :--- |
| `discoverCDP()` | Scans ports 9000-9003 for Antigravity debug endpoints |
| `discoverAllCDP()` | Discovers all running instances for multi-workspace support |
| `connectCDP(url)` | Establishes WebSocket connection with centralized message handler and 30s call timeout |
| `getActiveCDP()` | Returns the CDP connection for the currently active workspace |

### Snapshot Capture

| Function | Description |
| :--- | :--- |
| `captureSnapshot(cdp)` | Clones the chat DOM, strips interaction areas, converts local images to Base64, extracts CSS, and returns the result |

The capture pipeline:
1. Clone the `#conversation` / `#cascade` container
2. Remove editor inputs, fixed overlays, and desktop-only UI
3. Preserve action bars (Allow/Deny/Apply/Accept/Run/Review)
4. Convert `vscode-file://` image references to Base64
5. Fix inline `<div>` elements nested inside `<span>` parents
6. Extract all stylesheet rules
7. Return HTML + CSS + scroll info + stats

### Remote Commands

| Function | Description |
| :--- | :--- |
| `injectMessage(cdp, text)` | Locates the contenteditable editor, inserts text via `execCommand`, and clicks submit |
| `setMode(cdp, mode)` | Switches between Fast and Planning modes via text-based element targeting |
| `setModel(cdp, model)` | Changes the AI model through the model selector dropdown |
| `stopGeneration(cdp)` | Clicks the cancel/stop button |
| `clickElement(cdp, opts)` | Generic remote click with selector, text, and index-based targeting |
| `remoteScroll(cdp, opts)` | Syncs scroll position from client to Antigravity |
| `startNewChat(cdp)` | Triggers new conversation via keyboard shortcut |
| `getChatHistory(cdp)` | Scrapes conversation list from the history panel |
| `selectChat(cdp, title)` | Switches to a specific conversation by title |

### Multi-Workspace Management

The server maintains a `cdpInstances` Map keyed by debug port. Each entry stores:
- `cdp` - Active CDP connection
- `title` - Workspace name extracted from window title
- `workspacePath` - Project directory path
- `lastSnapshot` - Cached snapshot data
- `lastSnapshotHash` - 36-char hash for delta detection

Workspace discovery runs on a 5-second interval. New instances are auto-connected; stale connections are cleaned up.

## Client Architecture (app.js)

### Snapshot Rendering Pipeline

1. `loadSnapshot()` fetches `/snapshot` and injects the HTML
2. Pre-injection: regex strips Material icon text from HTML string
3. Post-injection: `cleanSnapshotContent()` hides remaining icon artifacts via DOM walk
4. `addScrollBoundaryMarkers()` adds TOP/BOTTOM markers
5. `wireActionButtons()` detects and wires Apply/Allow/Deny/Run buttons
6. `addMobileCopyButtons()` adds copy buttons to code blocks

### Action Button Wiring

`wireActionButtons()` scans the snapshot for `<button>` elements matching action keywords (apply, accept, allow, deny, run, approve, reject, save, keep, discard, confirm, cancel, retry). Matched elements:
- Get styled with `.gold-action-btn` class
- Get click handlers that POST to `/remote-click` with the button's text
- Show visual feedback: SENDING (cyan) -> DONE (green) or FAILED (red)
- Trigger snapshot refresh 800ms after successful click

### Tools Row

Three input tools below the suggestion chips:
- **Media** - Opens native file picker, uploads via `/upload-media`, inserts file paths into input
- **Mentions** - Inserts `@` at cursor position
- **Workflows** - Pre-fills input with task checklist prompt

## API Reference

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/snapshot` | Current chat snapshot |
| `POST` | `/send` | Send message to Antigravity |
| `POST` | `/set-mode` | Switch Fast/Planning |
| `POST` | `/set-model` | Change AI model |
| `POST` | `/stop` | Stop generation |
| `POST` | `/new-chat` | Start new conversation |
| `GET` | `/chat-history` | List conversations |
| `POST` | `/select-chat` | Switch conversation |
| `GET` | `/workspaces` | List Antigravity instances |
| `POST` | `/switch-workspace` | Switch active workspace |
| `POST` | `/upload-media` | Upload files (multer) |
| `POST` | `/remote-click` | Click element in Antigravity |
| `POST` | `/remote-scroll` | Sync scroll position |
| `GET` | `/app-state` | Current mode/model/status |
| `GET` | `/health` | Server health |
| `GET` | `/chat-status` | Chat container status |

## CSS Design System

Variables defined in `:root`:
- `--bg-base`, `--bg-panel`, `--bg-card` - Background layers
- `--amber` (#ff9500) - Primary accent
- `--cyan` (#00e5ff) - Secondary accent / links
- `--font-mono` - IBM Plex Mono
- `--border` - Panel borders

Mobile overrides are scoped to `@media (max-width: 768px)` with 44px minimum tap targets.

## Security

- Cookie-based authentication with signed httpOnly cookies
- LAN requests bypass auth for convenience
- Magic link support via `?key=` query parameter
- Input sanitization via `JSON.stringify` before CDP injection
- HTML escaping on all user-facing output
