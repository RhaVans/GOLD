# Security - GOLD

## Authentication

- **Session management**: Signed httpOnly cookies via `cookie-parser`
- **LAN bypass**: Requests from local network IPs skip authentication
- **Magic links**: URL parameter `?key=PASSWORD` sets auth cookie and redirects
- **Default credentials warning**: Server prints console warnings on startup if default APP_PASSWORD is detected

## Content Security

- **CSP enforcement**: `script-src 'self'` blocks inline script execution
- **No inline handlers**: All event logic is in `app.js`, no `onclick` attributes in HTML
- **Input sanitization**: User messages are escaped via `JSON.stringify` before CDP injection
- **Output encoding**: Chat history titles and user-facing data pass through `escapeHtml()` before DOM insertion

## CDP Security

- **Scoped evaluation**: All `Runtime.evaluate` calls target specific execution contexts
- **Clone-before-capture**: DOM is cloned before snapshot extraction, preventing interference with the active IDE session
- **No credential exposure**: CDP commands do not access filesystem, environment variables, or authentication tokens

## Network

- **Local mode**: Server binds to all interfaces but is only accessible on LAN by default
- **Web mode**: ngrok tunnel provides encrypted HTTPS access from external networks
- **HTTPS support**: Optional self-signed SSL certificates via `certs/` directory

## File Upload

- **Size limit**: 50MB maximum per file via multer
- **Filename sanitization**: Special characters stripped from uploaded filenames
- **Storage isolation**: Uploads stored in `uploads/` directory, gitignored

## Known Risks

| Risk | Mitigation |
| :--- | :--- |
| Default APP_PASSWORD fallback in server.js | Console warning on startup; override via .env |
| Self-signed certificates trigger browser warnings | Expected behavior; documented for users |
| Snapshot content may contain sensitive code | Auth required for all non-LAN access |
| CDP has full Runtime.evaluate access | Scoped to chat container; no arbitrary file access |

## Reporting

Report security issues via GitHub Issues with the `security` label.