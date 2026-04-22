# Release Notes - GOLD

## v2.0.0 - GOLD Redesign
**Date:** April 22, 2026

Complete redesign. Terminal-inspired UI, multi-workspace support, media upload, mobile action button relay.

### Interface

- Bloomberg Terminal-inspired dark UI with IBM Plex Mono typography
- Amber-on-black color scheme with cyan accent for links and status
- 12-column grid layout with high-density information panels
- Header: GOLD branding, live indicator, workspace bar, action buttons
- Footer: suggestion chips, tools row, input bar with GOLD> prompt

### Multi-Workspace Support

- Auto-discovery of all running Antigravity instances across ports 9000-9003
- Workspace switcher with drawer-based selection UI
- Independent snapshot caching per workspace
- 5-second polling interval for instance discovery

### Mobile Responsive Design

- Separate CSS layer for viewports under 768px
- 44px minimum tap targets on all interactive elements
- Mobile-specific tools row (Media, Mentions, Workflows)
- Mobile code block copy buttons

### Dark Theme Enforcement

- Shell protection CSS prevents light-theme leakage from snapshot content
- Blanket nuke rule forces transparent backgrounds on all injected elements
- Forced terminal-style text color on all snapshot content
- Scroll boundary markers at top/bottom of chat content

### Action Button Relay

- Detects Apply/Accept/Allow/Deny/Run/Approve/Reject/Save/Keep/Discard buttons in snapshots
- Wires click handlers that relay to Antigravity via CDP remote-click
- Visual feedback states: pending (cyan), done (green), error (red)
- Auto-refresh snapshot 800ms after successful action

### Media Upload

- File picker integration (images, videos, documents, code files)
- Server-side storage via multer with 50MB limit
- File paths inserted into chat input for Antigravity reference

### Material Icon Cleanup

- Regex-based HTML sanitization strips icon text (exit_to_app, content_copy, etc.) before DOM insertion
- DOM walker as secondary cleanup for elements with child nodes
- Pattern matching for any underscore-separated lowercase text

### Loading States

- Centered spinner with "LOADING CONVERSATION..." text on initial load
- Loading indicators during conversation and workspace switching
- Scroll boundary markers replace blank space at content edges

### Infrastructure

- Added multer dependency for file upload support
- Expanded snapshot capture action bar preservation (apply, accept, reject, save, keep, discard)
- Cookie-based auth with magic link and QR code support
- ngrok integration for remote access

---

## Previous Versions

For release history prior to v2.0.0, see the original project repository.
