# Contributing to GOLD

## Development Setup

1. Clone the repository
2. Run `npm install`
3. Start Antigravity with `--remote-debugging-port=9000`
4. Run `node server.js`
5. Access from browser at `http://localhost:3000`

## Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make changes
4. Test on both desktop and mobile viewports
5. Submit a pull request

## Code Standards

- All client-side logic goes in `public/js/app.js`
- All styles go in `public/css/style.css`
- Server routes and CDP logic go in `server.js`
- Use `var(--css-variables)` defined in the design system, not hardcoded colors
- Mobile overrides go inside the `@media (max-width: 768px)` block
- No inline event handlers in HTML; all events are wired in JS

## Pre-Submission Checklist

- [ ] No hardcoded credentials or personal IPs
- [ ] SSL certificates not committed (check `.gitignore`)
- [ ] Snapshot capture works with current Antigravity version
- [ ] UI is responsive at 375px (mobile) and 1920px (desktop)
- [ ] Dark theme is consistent; no white patches in snapshot content
- [ ] Action buttons (Apply/Allow/Deny) remain interactive after changes
- [ ] Server starts without errors after changes

## File Ownership

| File | Scope |
| :--- | :--- |
| `server.js` | CDP connection, REST API, WebSocket, file upload |
| `public/index.html` | Dashboard layout and structure |
| `public/css/style.css` | Design system, responsive overrides |
| `public/js/app.js` | Client logic, snapshot rendering, tool wiring |
| `ui_inspector.js` | CDP element inspection utility |

## Testing

Test the following before submitting:

1. Snapshot loads and renders correctly
2. Send message works
3. Mode/model switching works
4. History navigation works
5. Media upload works
6. Action buttons relay clicks to Antigravity
7. Scroll boundary markers appear at top/bottom
8. No icon text artifacts visible
