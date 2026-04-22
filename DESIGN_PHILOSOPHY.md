# Design Philosophy - GOLD

## Problem

AI-assisted coding sessions in Antigravity involve long generation times. Developers are tethered to their desks, unable to monitor progress or provide input without physical access to the machine.

## Solution

GOLD is a remote viewport for Antigravity. It captures the IDE's chat interface via CDP and serves it as a web dashboard accessible from any device. It is not a replacement for the desktop IDE; it is a wireless extension.

## Design Principles

### 1. Terminal Aesthetic

The interface draws from Bloomberg Terminal and financial trading systems. High-density information display with monospace typography (IBM Plex Mono), amber-on-black color scheme, and minimal chrome. Every pixel serves a purpose.

This is a deliberate departure from consumer-style chat UIs. The target user is a developer who values density, speed, and precision over visual flourishes.

### 2. Dark Mode as Default

The entire interface enforces a dark theme. Snapshot content from Antigravity is sanitized with CSS overrides to prevent light-themed leakage. Shell protection rules re-assert dark backgrounds on all injected content. This is non-negotiable for readability and consistency.

### 3. Mobile-First Ergonomics

Mobile is not a scaled-down desktop. The interface uses separate responsive breakpoints with:
- 44px minimum tap targets on all interactive elements
- Vertically stacked layouts instead of horizontal panels
- Larger typography for touch-based reading
- Tools row with direct-action buttons (Media, Mentions, Workflows)

### 4. Text-Based Targeting

Selecting elements in a dynamically changing IDE is brittle. GOLD uses text-based selection with leaf-node isolation instead of CSS class selectors. When multiple identical elements exist (e.g., three "Thought for 2s" blocks), occurrence index tracking ensures accurate targeting.

### 5. Action Preservation

The snapshot capture pipeline aggressively strips desktop-only UI (editors, overlays, toolbars) but explicitly preserves action bars. Buttons containing "Allow", "Deny", "Apply", "Accept", "Run", "Review", "Save", and "Reject" survive the cleanup and are wired to relay clicks back to Antigravity via CDP.

### 6. Defensive CSS

Antigravity injects complex, deeply-scoped stylesheets. GOLD handles this with:
- Blanket nuke: `#chatContent * { background: transparent !important }`
- Shell protection: re-asserts `background: #000000 !important` on key containers
- Forced text color: `color: #e8e0cc !important` on all snapshot content
- Material icon cleanup: regex strips icon text before DOM insertion

### 7. Loading Transparency

Users should never stare at blank space without knowing why. Loading indicators appear during:
- Initial snapshot fetch
- Conversation switching
- Workspace switching

Scroll boundaries ("TOP OF CONVERSATION" / "LIVE -- END OF SNAPSHOT") mark the edges of available content.

## Technical Trade-offs

| Decision | Rationale |
| :--- | :--- |
| Polling at 1000ms intervals | Balance between responsiveness and CPU overhead |
| Delta detection via hash | Avoids broadcasting unchanged snapshots |
| Regex HTML cleanup before DOM insertion | More reliable than post-insertion DOM walking for icon text |
| Cookie auth over token auth | Simpler mobile experience, no header management needed |
| Multer for uploads | Standard, well-tested file upload middleware |
| No lazy loading of chat content | Snapshot is a single HTML blob; partial loading would require Antigravity-side changes |

## Constraints

- GOLD cannot modify Antigravity's internal state beyond what CDP `Runtime.evaluate` allows
- Snapshot fidelity depends on Antigravity's DOM structure, which may change between versions
- File uploads are stored server-side; Antigravity receives file paths, not binary data
- Multi-workspace switching requires all instances to run on different debug ports
