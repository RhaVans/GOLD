// --- Mobile Detection ---
const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
if (isMobile) document.body.classList.add('is-mobile');

// --- Elements ---
const chatContainer = document.getElementById('chatContainer');
const chatContent = document.getElementById('chatContent');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText'); // null in new UI — kept for compat
const stopBtn = document.getElementById('stopBtn');
const modeText = document.getElementById('modeText');
const modelText = document.getElementById('modelText');
const resumeLiveBtn = document.getElementById('resumeLiveBtn');

// New UI Elements
const liveIndicator = document.getElementById('liveIndicator');
const newChatBtn = document.getElementById('newChatBtn');
const historyBtn = document.getElementById('historyBtn');
const refreshBtn = document.getElementById('refreshBtn');
const modeBtn = document.getElementById('modeBtn');
const modelBtn = document.getElementById('modelBtn');
const scrollToBottomBtn = document.getElementById('scrollToBottom');
const backHistoryBtn = document.getElementById('backHistoryBtn');
const dismissSslBtn = document.getElementById('dismissSslBtn');
const enableHttpsBtn = document.getElementById('enableHttpsBtn');
const supportBtn = document.getElementById('supportBtn');
const supportOverlay = document.getElementById('supportOverlay');
const closeSupportBtn = document.getElementById('closeSupportBtn');

// Quick action chips
const quickActionChips = document.querySelectorAll('.chip');

// Modal Elements
const modalOverlay = document.getElementById('modalOverlay');
const modalList = document.getElementById('modalList');
const modalTitle = document.getElementById('modalTitle');
const closeModalBtn = document.getElementById('closeModalBtn');

// --- State ---
let autoRefreshEnabled = true;
let userIsScrolling = false;
let userScrollLockUntil = 0; // Timestamp until which we respect user scroll
let lastScrollPosition = 0;
let ws = null;
let idleTimer = null;
let lastHash = '';
let currentMode = 'Fast';
let chatIsOpen = true; // Track if a chat is currently open


// --- Auth Utilities ---
async function fetchWithAuth(url, options = {}) {
    // Add ngrok skip warning header to all requests
    if (!options.headers) options.headers = {};
    options.headers['ngrok-skip-browser-warning'] = 'true';

    try {
        const res = await fetch(url, options);
        if (res.status === 401) {
            console.log('[AUTH] Unauthorized, redirecting to login...');
            window.location.href = '/login.html';
            return new Promise(() => { }); // Halt execution
        }
        return res;
    } catch (e) {
        throw e;
    }
}
const USER_SCROLL_LOCK_DURATION = 3000; // 3 seconds of scroll protection

// --- Sync State (Desktop is Always Priority) ---
async function fetchAppState() {
    try {
        const res = await fetchWithAuth('/app-state');
        const data = await res.json();

        // Mode Sync (Fast/Planning) - Desktop is source of truth
        if (data.mode && data.mode !== 'Unknown') {
            modeText.textContent = data.mode;
            modeBtn.classList.toggle('active', data.mode === 'Planning');
            currentMode = data.mode;
        }

        // Model Sync - Desktop is source of truth
        if (data.model && data.model !== 'Unknown') {
            modelText.textContent = data.model;
        }

        console.log('[SYNC] State refreshed from Desktop:', data);
    } catch (e) { console.error('[SYNC] Failed to sync state', e); }
}

// --- SSL Banner ---
const sslBanner = document.getElementById('sslBanner');

async function checkSslStatus() {
    // Only show banner if currently on HTTP
    if (window.location.protocol === 'https:') return;

    // Check if user dismissed the banner before
    if (localStorage.getItem('sslBannerDismissed')) return;

    sslBanner.style.display = 'flex';
}

async function enableHttps() {
    const btn = document.getElementById('enableHttpsBtn');
    btn.textContent = 'Generating...';
    btn.disabled = true;

    try {
        const res = await fetchWithAuth('/generate-ssl', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            sslBanner.innerHTML = `
                <span>✅ ${data.message}</span>
                <button id="sslReloadBtn">Reload After Restart</button>
            `;
            sslBanner.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
            
            // Add listener to the newly created button
            const reloadBtn = document.getElementById('sslReloadBtn');
            if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());
        } else {
            btn.textContent = 'Failed - Retry';
            btn.disabled = false;
        }
    } catch (e) {
        btn.textContent = 'Error - Retry';
        btn.disabled = false;
    }
}

function dismissSslBanner() {
    sslBanner.style.display = 'none';
    localStorage.setItem('sslBannerDismissed', 'true');
}

// Check SSL on load
checkSslStatus();
// --- Models ---
const MODELS = [
    "Gemini 3.1 Pro (High)",
    "Gemini 3.1 Pro (Low)",
    "Gemini 3 Flash",
    "Claude Sonnet 4.6 (Thinking)",
    "Claude Opus 4.6 (Thinking)",
    "GPT-OSS 120B (Medium)"
];

// --- WebSocket ---
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        console.log('WS Connected');
        updateStatus(true);
        loadSnapshot();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'error' && data.message === 'Unauthorized') {
            window.location.href = '/login.html';
            return;
        }
        if (data.type === 'snapshot_update' && autoRefreshEnabled && !userIsScrolling) {
            loadSnapshot();
        }
        // Multi-workspace events
        if (data.type === 'workspace_changed' || data.type === 'workspaces_updated') {
            fetchWorkspaces();
            if (data.type === 'workspace_changed') {
                // Active workspace changed (possibly auto-switched), reload everything
                setTimeout(loadSnapshot, 300);
                setTimeout(fetchAppState, 500);
            }
        }
    };

    ws.onclose = () => {
        console.log('WS Disconnected');
        updateStatus(false);
        setTimeout(connectWebSocket, 2000);
    };
}

function updateStatus(connected) {
    if (connected) {
        statusDot.classList.remove('disconnected', 'pending');
        if (liveIndicator) liveIndicator.style.color = 'var(--green)';
    } else {
        statusDot.classList.add('disconnected');
        statusDot.classList.remove('connected');
        if (liveIndicator) liveIndicator.style.color = 'var(--red)';
    }
}

// --- Rendering ---
async function loadSnapshot() {
    try {
        // Show loading barrier if no content is displayed yet
        if (!chatContent.innerHTML || chatContent.innerHTML.trim() === '' || chatContent.querySelector('.loading-state')) {
            chatContent.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading conversation...</p></div>';
        }

        // Flash refresh status
        const connPanel = document.getElementById('connPanelContent');
        if (connPanel) {
            connPanel.classList.remove('flash');
            void connPanel.offsetWidth;
            connPanel.classList.add('flash');
        }

        const response = await fetchWithAuth('/snapshot');
        if (!response.ok) {
            if (response.status === 503) {
                // No snapshot available - likely no chat open
                chatIsOpen = false;
                showEmptyState();
                return;
            }
            throw new Error('Failed to load');
        }

        // Mark chat as open since we got a valid snapshot
        chatIsOpen = true;

        const data = await response.json();

        // Capture scroll state BEFORE updating content
        const scrollPos = chatContainer.scrollTop;
        const scrollHeight = chatContainer.scrollHeight;
        const clientHeight = chatContainer.clientHeight;
        const isNearBottom = scrollHeight - scrollPos - clientHeight < 120;
        const isUserScrollLocked = Date.now() < userScrollLockUntil;

        // --- UPDATE STATS ---
        if (data.stats) {
            const kbs = Math.round((data.stats.htmlSize + data.stats.cssSize) / 1024);
            const nodes = data.stats.nodes;
            const statsEl = document.getElementById('statsText');
            if (statsEl) statsEl.textContent = `NODES: ${nodes} · SIZE: ${kbs}KB`;
        }

        const lastSyncTs = document.getElementById('lastSyncTs');
        if (lastSyncTs) {
            const now = new Date();
            lastSyncTs.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        }

        // --- CSS INJECTION (Cached) ---
        let styleTag = document.getElementById('cdp-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'cdp-styles';
            document.head.appendChild(styleTag);
        }

        const darkModeOverrides = `/* --- BASE SNAPSHOT CSS --- */
${data.css}

/* --- PROTECT AGPC SHELL FROM SNAPSHOT CSS CONTAMINATION --- */
html { background: #080808 !important; height: 100% !important; overflow: hidden !important; }
body { background: #080808 !important; height: 100% !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; color: #e0d8c4 !important; font-size: 12px !important; }
.hdr-bar { background: #111111 !important; }
.ws-row { background: #080808 !important; }
.model-row { background: #111111 !important; }
.chat-area { background: #080808 !important; flex: 1 !important; overflow-y: auto !important; }
.chips-row { background: #080808 !important; }
.input-bar { background: #080808 !important; }

/* --- FORCE BLOOMBERG TERMINAL OVERRIDES --- */
/* Scoped to #chatContent to avoid breaking AGPC shell layout */

:root {
    --bg-app: #0a0a0a !important;
    --text-main: #e8e0cc !important;
    --text-muted: #888880 !important;
    --border-color: #2a2a2a !important;
    --accent: #ff9500 !important;
    --accent-glow: transparent !important;
}

/* Only target Antigravity snapshot containers — NOT body/html */
#chatContent #conversation,
#chatContent #chat,
#chatContent #cascade,
#chatContent > div {
    background-color: transparent !important;
    color: var(--text-main) !important;
    font-family: 'IBM Plex Mono', 'Courier New', 'Lucida Console', monospace !important;
    font-size: 12px !important;
    line-height: 1.4 !important;
    position: relative !important;
    height: auto !important;
    width: 100% !important;
    letter-spacing: normal !important;
}

/* Fix stacking inside snapshot content */
#chatContent #conversation > div,
#chatContent #chat > div,
#chatContent #cascade > div {
    position: static !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    border: none !important;
    border-bottom: 1px solid var(--border-color) !important;
    padding: 8px 0 !important;
    margin: 0 !important;
}

/* Force terminal style — scoped to snapshot content */
#chatContent * {
    border-radius: 0 !important;
    box-shadow: none !important;
    background-color: transparent !important;
    background: transparent !important;
    color: #e8e0cc !important;
}

#chatContent p, #chatContent h1, #chatContent h2, #chatContent h3,
#chatContent h4, #chatContent h5, #chatContent h6,
#chatContent span, #chatContent div, #chatContent li {
    color: inherit !important;
    font-family: inherit !important;
}

/* Force black inline text to terminal text */
#chatContent [style*="color: rgb(0, 0, 0)"],
#chatContent [style*="color: black"],
#chatContent [style*="color:#000"],
#chatContent [style*="color: #000"] {
    color: var(--text-main) !important;
}

#chatContent a {
    color: #00d4d4 !important;
    text-decoration: none !important;
}
#chatContent a:hover {
    text-decoration: underline !important;
    background: rgba(0, 212, 212, 0.1) !important;
}

/* Hide broken local file icons */
#chatContent img[src^="/c:"],
#chatContent img[src^="/C:"],
#chatContent img[src*="AppData"] {
    display: none !important;
}

/* Inline Code - Ultra-compact Terminal */
#chatContent :not(pre) > code {
    padding: 0px 4px !important;
    background-color: transparent !important;
    color: #00cc66 !important;
    font-size: 12px !important;
    border: 1px solid var(--border-color) !important;
    white-space: normal !important;
}

/* Code blocks — re-apply dark background */
#chatContent pre,
#chatContent code,
#chatContent .monaco-editor-background,
#chatContent [class*="terminal"] {
    background-color: #111111 !important;
    background: #111111 !important;
    color: #e8e0cc !important;
    font-family: 'IBM Plex Mono', monospace !important;
    border: 1px solid var(--border-color) !important;
    font-size: 11px !important;
}

/* Multi-line Code Block */
#chatContent pre {
    position: relative !important;
    white-space: pre-wrap !important; 
    word-break: break-word !important;
    padding: 8px !important;
    margin: 4px 0 !important;
    display: block !important;
    width: 100% !important;
    border-left: 2px solid #ff9500 !important;
}

#chatContent pre:not(.single-line-pre) > code {
    display: block !important;
    width: 100% !important;
    overflow-x: auto !important;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    color: #e8e0cc !important;
}

#chatContent .mobile-copy-btn {
    position: absolute !important;
    top: 0 !important;
    right: 0 !important;
    background: #ff9500 !important;
    color: #0a0a0a !important;
    border: none !important;
    padding: 2px 6px !important;
    font-size: 10px !important;
    font-weight: bold !important;
    cursor: pointer !important;
    text-transform: uppercase !important;
}
#chatContent .mobile-copy-btn:hover {
    background: #e8e0cc !important;
}

#chatContent blockquote {
    border-left: 2px solid #00cc66 !important;
    background: transparent !important;
    color: #888880 !important;
    padding: 4px 8px !important;
    margin: 4px 0 !important;
    font-style: italic !important;
}

#chatContent table {
    border-collapse: collapse !important;
    width: 100% !important;
    border: 1px solid var(--border-color) !important;
    margin: 8px 0 !important;
}
#chatContent th, #chatContent td {
    border: 1px solid var(--border-color) !important;
    padding: 4px 8px !important;
    color: var(--text-main) !important;
}
#chatContent th {
    background: #111111 !important;
    color: #888880 !important;
    font-weight: bold !important;
    text-align: left !important;
}

/* Hide Material Icon text names (they render as scrambled vertical text) */
#chatContent .material-icons,
#chatContent .material-symbols-outlined,
#chatContent .material-symbols-rounded,
#chatContent [class*="material-icon"],
#chatContent [data-icon],
#chatContent i[class*="icon"] {
    font-size: 0 !important;
    width: 0 !important;
    overflow: hidden !important;
}

/* Fix excessive spacing in snapshot content */
#chatContent > div:first-child {
    padding-top: 0 !important;
    margin-top: 0 !important;
}

/* Hide Antigravity floating action buttons (undo, copy, etc.) — non-functional in remote context */
#chatContent button[class*="action"],
#chatContent [class*="toolbar"] button,
#chatContent [class*="actions-container"],
#chatContent [class*="action-bar"],
#chatContent [style*="position: absolute"][style*="right"],
#chatContent [style*="position: fixed"] {
    display: none !important;
}`;
        styleTag.textContent = darkModeOverrides;

        // Strip Material icon text from HTML before inserting (nuclear approach)
        let cleanHtml = data.html;
        // Remove elements whose content is just a material icon name
        cleanHtml = cleanHtml.replace(/<(span|i|button)[^>]*>\s*(exit_to_app|content_copy|content_paste|undo|redo|close|check|edit|delete|add|remove|search|settings|more_vert|more_horiz|arrow_back|arrow_forward|expand_more|expand_less|keyboard_return|compare_arrows|thumb_up|thumb_down|difference|differ|launch|open_in_new|alternate_email|chevron_right|chevron_left|menu|refresh|visibility|visibility_off|file_copy|folder|folder_open|code|terminal|play_arrow|pause|stop|skip_next|skip_previous|done|done_all|clear|backspace|send|attach_file|insert_drive_file|description|text_snippet|auto_fix_high|smart_toy|psychology|memory|bolt|flash_on|flash_off|bookmark|bookmark_border|star|star_border|favorite|favorite_border|info|warning|error|help|help_outline|feedback|bug_report|build|extension|lightbulb|share|replay|fast_forward|fast_rewind)\s*<\/\1>/gi, '');
        chatContent.innerHTML = cleanHtml;


        // Add mobile copy buttons to all code blocks
        addMobileCopyButtons();

        // Clean up Antigravity UI artifacts that don't work in remote context
        cleanSnapshotContent();

        // Add scroll boundary markers so users don't see blank voids
        addScrollBoundaryMarkers();

        // Make action buttons (Apply, Accept, Allow, Deny, Run) interactive on mobile
        wireActionButtons();

        // Smart scroll behavior: respect user scroll, only auto-scroll when appropriate
        if (isUserScrollLocked) {
            // User recently scrolled - try to maintain their approximate position
            // Use percentage-based restoration for better accuracy
            const scrollPercent = scrollHeight > 0 ? scrollPos / scrollHeight : 0;
            const newScrollPos = chatContainer.scrollHeight * scrollPercent;
            chatContainer.scrollTop = newScrollPos;
        } else if (isNearBottom || scrollPos === 0) {
            // User was at bottom or hasn't scrolled - auto scroll to bottom
            scrollToBottom();
        } else {
            // Preserve exact scroll position
            chatContainer.scrollTop = scrollPos;
        }

    } catch (err) {
        console.error(err);
    }
}

// --- Clean Snapshot Content (remove broken Antigravity UI artifacts) ---
function cleanSnapshotContent() {
    // Material icon names that render as garbage text
    const iconNames = new Set(['exit_to_app', 'content_copy', 'content_paste', 'undo', 'redo',
        'close', 'check', 'edit', 'delete', 'add', 'remove', 'search', 'settings',
        'more_vert', 'more_horiz', 'arrow_back', 'arrow_forward', 'expand_more',
        'expand_less', 'keyboard_return', 'compare_arrows', 'thumb_up', 'thumb_down',
        'difference', 'differ', 'launch', 'open_in_new', 'alternate_email',
        'chevron_right', 'chevron_left', 'menu', 'refresh', 'visibility',
        'visibility_off', 'file_copy', 'folder', 'folder_open', 'code',
        'terminal', 'play_arrow', 'pause', 'stop', 'skip_next', 'skip_previous',
        'fast_forward', 'fast_rewind', 'replay', 'share', 'bookmark',
        'bookmark_border', 'star', 'star_border', 'favorite', 'favorite_border',
        'info', 'warning', 'error', 'help', 'help_outline', 'feedback',
        'bug_report', 'build', 'extension', 'lightbulb', 'lightbulb_outline',
        'done', 'done_all', 'clear', 'backspace', 'send', 'attach_file',
        'insert_drive_file', 'description', 'text_snippet', 'auto_fix_high',
        'smart_toy', 'psychology', 'memory', 'bolt', 'flash_on', 'flash_off']);

    // Pattern: single word that looks like a material icon (lowercase + underscores only, 2+ chars)
    const iconPattern = /^[a-z][a-z_]{1,30}$/;

    // Walk all elements, hide ones that are just icon names
    const walker = document.createTreeWalker(chatContent, NodeFilter.SHOW_ELEMENT);
    const toHide = [];
    while (walker.nextNode()) {
        const el = walker.currentNode;
        const text = (el.textContent || '').trim();
        // Match elements whose ENTIRE text is just a material icon name
        if (text && el.children.length === 0 && (iconNames.has(text) || 
            (iconPattern.test(text) && text.includes('_')))) {
            toHide.push(el);
        }
    }
    toHide.forEach(el => {
        el.style.display = 'none';
        el.style.width = '0';
        el.style.height = '0';
        el.style.overflow = 'hidden';
    });
}

// --- Scroll Boundary Markers ---
function addScrollBoundaryMarkers() {
    // Remove existing markers to avoid duplicates
    chatContent.querySelectorAll('.scroll-boundary').forEach(el => el.remove());

    // Top marker
    const topMarker = document.createElement('div');
    topMarker.className = 'scroll-boundary scroll-boundary--top';
    topMarker.innerHTML = '─── TOP OF CONVERSATION ───';
    chatContent.insertBefore(topMarker, chatContent.firstChild);

    // Bottom marker
    const bottomMarker = document.createElement('div');
    bottomMarker.className = 'scroll-boundary scroll-boundary--bottom';
    bottomMarker.innerHTML = '─── LIVE · END OF SNAPSHOT ───';
    chatContent.appendChild(bottomMarker);
}

// --- Wire Action Buttons (Apply/Accept/Allow/Deny/Run) ---
function wireActionButtons() {
    // Action keywords that indicate interactive buttons in Antigravity
    const actionKeywords = [
        'apply', 'accept', 'accept all', 'allow', 'deny',
        'run', 'approve', 'reject', 'save all', 'save',
        'keep', 'discard', 'confirm', 'cancel', 'retry',
        'apply all', 'apply changes', 'run command',
        'yes', 'no', 'skip', 'expand', 'allow once',
        'always allow', 'run all'
    ];

    // Find all button-like elements in the snapshot
    const candidates = chatContent.querySelectorAll('button, [role="button"], a[class*="btn"], div[class*="btn"], span[class*="btn"]');

    candidates.forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        // Skip if it's our own UI element
        if (el.closest('.scroll-boundary') || el.closest('.mobile-copy-btn')) return;
        // Skip very long text (not a button label)
        if (text.length > 40) return;

        // Check if the text matches any action keyword
        const isAction = actionKeywords.some(kw => text === kw || text.startsWith(kw));
        if (!isAction) return;

        // Mark as interactive
        el.classList.add('gold-action-btn');
        el.style.cursor = 'pointer';
        el.style.pointerEvents = 'auto';

        // Wire click handler
        el.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Visual feedback
            const originalText = el.textContent;
            el.textContent = 'SENDING...';
            el.classList.add('gold-action-btn--pending');

            try {
                const res = await fetchWithAuth('/remote-click', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        selector: 'button',
                        index: 0,
                        textContent: originalText.trim()
                    })
                });
                const data = await res.json();

                if (data.success) {
                    el.textContent = 'DONE';
                    el.classList.remove('gold-action-btn--pending');
                    el.classList.add('gold-action-btn--done');
                    // Refresh snapshot after action
                    setTimeout(loadSnapshot, 800);
                } else {
                    el.textContent = 'FAILED';
                    el.classList.remove('gold-action-btn--pending');
                    el.classList.add('gold-action-btn--error');
                    setTimeout(() => { el.textContent = originalText; el.className = el.className.replace(/gold-action-btn--(done|error|pending)/g, ''); }, 2000);
                }
            } catch (err) {
                console.error('Action button error:', err);
                el.textContent = originalText;
                el.classList.remove('gold-action-btn--pending');
            }
        });
    });
}

// --- Mobile Code Block Copy Functionality ---
function addMobileCopyButtons() {
    // Find all pre elements (code blocks) in the chat
    const codeBlocks = chatContent.querySelectorAll('pre');

    codeBlocks.forEach((pre, index) => {
        // Skip if already has our button
        if (pre.querySelector('.mobile-copy-btn')) return;

        // Get the code text
        const codeElement = pre.querySelector('code') || pre;
        const textToCopy = (codeElement.textContent || codeElement.innerText).trim();

        // Check if there's a newline character in the TRIMMED text
        // This ensures single-line blocks with trailing newlines don't get buttons
        const hasNewline = /\n/.test(textToCopy);

        // If it's a single line code block, don't add the copy button
        if (!hasNewline) {
            pre.classList.remove('has-copy-btn');
            pre.classList.add('single-line-pre');
            return;
        }

        // Add class for padding
        pre.classList.remove('single-line-pre');
        pre.classList.add('has-copy-btn');

        // Create the copy button (icon only)
        const copyBtn = document.createElement('button');
        copyBtn.className = 'mobile-copy-btn';
        copyBtn.setAttribute('data-code-index', index);
        copyBtn.setAttribute('aria-label', 'Copy code');
        copyBtn.innerHTML = `COPY`;

        // Add click handler for copy
        copyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const success = await copyToClipboard(textToCopy);

            if (success) {
                // Visual feedback
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = `OK`;
                copyBtn.style.background = '#00cc66';
                copyBtn.style.color = '#0a0a0a';

                // Reset after 2 seconds
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = `COPY`;
                    copyBtn.style.background = '';
                    copyBtn.style.color = '';
                }, 2000);
            } else {
                // Show Error
                copyBtn.innerHTML = `ERR`;
                copyBtn.style.background = '#ff3333';
                copyBtn.style.color = '#0a0a0a';
                setTimeout(() => {
                    copyBtn.innerHTML = `COPY`;
                    copyBtn.style.background = '';
                    copyBtn.style.color = '';
                }, 2000);
            }
        });

        // Insert button into pre element
        pre.appendChild(copyBtn);
    });
}

// --- Cross-platform Clipboard Copy ---
async function copyToClipboard(text) {
    // Method 1: Modern Clipboard API (works on HTTPS or localhost)
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            console.log('[COPY] Success via Clipboard API');
            return true;
        } catch (err) {
            console.warn('[COPY] Clipboard API failed:', err);
        }
    }

    // Method 2: Fallback using execCommand (works on HTTP, older browsers)
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;

        // Avoid scrolling to bottom on iOS
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        textArea.style.opacity = '0';

        document.body.appendChild(textArea);

        // iOS specific handling
        if (navigator.userAgent.match(/ipad|iphone/i)) {
            const range = document.createRange();
            range.selectNodeContents(textArea);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            textArea.setSelectionRange(0, text.length);
        } else {
            textArea.select();
        }

        const success = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (success) {
            console.log('[COPY] Success via execCommand fallback');
            return true;
        }
    } catch (err) {
        console.warn('[COPY] execCommand fallback failed:', err);
    }

    // Method 3: For Android WebView or restricted contexts
    // Show the text in a selectable modal if all else fails
    console.error('[COPY] All copy methods failed');
    return false;
}

function scrollToBottom() {
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
}

// --- Inputs ---
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Optimistic UI updates
    const previousValue = messageInput.value;
    messageInput.value = ''; // Clear immediately
    messageInput.style.height = 'auto'; // Reset height
    messageInput.blur(); // Close keyboard on mobile immediately

    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';

    try {
        // If no chat is open, start a new one first
        if (!chatIsOpen) {
            const newChatRes = await fetchWithAuth('/new-chat', { method: 'POST' });
            const newChatData = await newChatRes.json();
            if (newChatData.success) {
                // Wait for the new chat to be ready
                await new Promise(r => setTimeout(r, 800));
                chatIsOpen = true;
            }
        }

        const res = await fetchWithAuth('/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        // Always reload snapshot to check if message appeared
        setTimeout(loadSnapshot, 300);
        setTimeout(loadSnapshot, 800);
        setTimeout(checkChatStatus, 1000);

        // Don't revert the input - if user sees the message in chat, it was sent
        // Only log errors for debugging, don't show alert popups
        if (!res.ok) {
            console.warn('Send response not ok, but message may have been sent:', await res.json().catch(() => ({})));
        }
    } catch (e) {
        // Network error - still try to refresh in case it went through
        console.error('Send error:', e);
        setTimeout(loadSnapshot, 500);
    } finally {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
    }
}

// --- Event Listeners ---
sendBtn?.addEventListener('click', sendMessage);

// Remove the inline button logic and just export refresh 
if(refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        loadSnapshot();
        fetchAppState();
    });
}

let historyIndex = -1;
let commandHistory = [];

messageInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const val = messageInput.value.trim();
        if(val) {
            commandHistory.unshift(val);
            historyIndex = -1;
        }
        sendMessage();
    } else if (e.key === 'ArrowUp') {
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            messageInput.value = commandHistory[historyIndex];
            e.preventDefault();
        }
    } else if (e.key === 'ArrowDown') {
        if (historyIndex > 0) {
            historyIndex--;
            messageInput.value = commandHistory[historyIndex];
        } else if (historyIndex === 0) {
            historyIndex = -1;
            messageInput.value = '';
        }
        e.preventDefault();
    } else if (e.key === 'Escape') {
        messageInput.value = '';
        historyIndex = -1;
    }
});

messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// --- Support Modal Logic ---
if (supportBtn) {
    supportBtn.addEventListener('click', () => {
        if (supportOverlay) {
            supportOverlay.classList.add('show');
        }
    });
}

if (closeSupportBtn) {
    closeSupportBtn.addEventListener('click', () => {
        if (supportOverlay) {
            supportOverlay.classList.remove('show');
        }
    });
}

if (supportOverlay) {
    supportOverlay.addEventListener('click', (e) => {
        if (e.target === supportOverlay) {
            supportOverlay.classList.remove('show');
        }
    });
}

// --- Scroll Sync to Desktop ---
let scrollSyncTimeout = null;
let lastScrollSync = 0;
const SCROLL_SYNC_DEBOUNCE = 150; // ms between scroll syncs
let snapshotReloadPending = false;

async function syncScrollToDesktop() {
    const scrollPercent = chatContainer.scrollTop / (chatContainer.scrollHeight - chatContainer.clientHeight);
    try {
        await fetchWithAuth('/remote-scroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scrollPercent })
        });

        // After scrolling desktop, reload snapshot to get newly visible content
        // (Antigravity uses virtualized scrolling - only visible messages are in DOM)
        if (!snapshotReloadPending) {
            snapshotReloadPending = true;
            setTimeout(() => {
                loadSnapshot();
                snapshotReloadPending = false;
            }, 300);
        }
    } catch (e) {
        console.log('Scroll sync failed:', e.message);
    }
}

chatContainer?.addEventListener('scroll', () => {
    userIsScrolling = true;
    userScrollLockUntil = Date.now() + USER_SCROLL_LOCK_DURATION;
    clearTimeout(idleTimer);

    const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 120;
    if (isNearBottom) {
        if (resumeLiveBtn) resumeLiveBtn.classList.add('hidden');
        userScrollLockUntil = 0;
    } else {
        if (resumeLiveBtn) resumeLiveBtn.classList.remove('hidden');
    }

    const now = Date.now();
    if (now - lastScrollSync > SCROLL_SYNC_DEBOUNCE) {
        lastScrollSync = now;
        clearTimeout(scrollSyncTimeout);
        scrollSyncTimeout = setTimeout(syncScrollToDesktop, 100);
    }

    idleTimer = setTimeout(() => {
        userIsScrolling = false;
        autoRefreshEnabled = true;
    }, 5000);
});

resumeLiveBtn?.addEventListener('click', () => {
    userIsScrolling = false;
    userScrollLockUntil = 0;
    scrollToBottom();
});

// HOTKEYS
document.addEventListener('keydown', (e) => {
    // F2: Connect/Focus workspace switch
    if (e.key === 'F2') {
        e.preventDefault();
        // Fallback: prompt for port
        const port = prompt('Enter Workspace Port (e.g. 9000):');
        if(port) switchWorkspace(parseInt(port));
    }
    // F3: Mode toggle
    if (e.key === 'F3') {
        e.preventDefault();
        const modes = ['Fast', 'Planning'];
        const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
        changeMode(nextMode);
    }
    // F5: Refresh
    if (e.key === 'F5') {
        e.preventDefault();
        loadSnapshot();
        fetchAppState();
    }
    // ESC: Cancel modal or clear input
    if (e.key === 'Escape') {
        if (modalOverlay?.classList.contains('show')) {
            modalOverlay.classList.remove('show');
        } else {
            messageInput.value = '';
        }
    }
});

// --- Quick Actions ---
function quickAction(text) {
    messageInput.value = text;
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
    messageInput.focus();
}

// --- Stop Logic ---
stopBtn.addEventListener('click', async () => {
    stopBtn.style.opacity = '0.5';
    try {
        const res = await fetchWithAuth('/stop', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            // alert('Stopped');
        } else {
            // alert('Error: ' + data.error);
        }
    } catch (e) { }
    setTimeout(() => stopBtn.style.opacity = '1', 500);
});

// --- New Chat Logic ---
async function startNewChat() {
    newChatBtn.style.opacity = '0.5';
    newChatBtn.style.pointerEvents = 'none';

    try {
        const res = await fetchWithAuth('/new-chat', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            // Reload snapshot to show new empty chat
            setTimeout(loadSnapshot, 500);
            setTimeout(loadSnapshot, 1000);
            setTimeout(checkChatStatus, 1500);
        } else {
            console.error('Failed to start new chat:', data.error);
        }
    } catch (e) {
        console.error('New chat error:', e);
    }

    setTimeout(() => {
        newChatBtn.style.opacity = '1';
        newChatBtn.style.pointerEvents = 'auto';
    }, 500);
}

newChatBtn.addEventListener('click', startNewChat);

// --- Chat History Logic ---
async function showChatHistory() {
    const historyLayer = document.getElementById('historyLayer');
    const historyList = document.getElementById('historyList');

    // Show loading state
    historyList.innerHTML = `
        <div class="history-state-container">
            <div class="history-spinner"></div>
            <div class="history-state-text">Loading History...</div>
        </div>
    `;
    historyLayer.classList.add('show');
    historyBtn.style.opacity = '1';

    try {
        const res = await fetchWithAuth('/chat-history');
        const data = await res.json();

        if (data.error) {
            historyList.innerHTML = `
                <div class="history-state-container">
                    <div class="history-state-icon">⚠️</div>
                    <div class="history-state-title">Error loading history</div>
                    <div class="history-state-desc">${data.error}</div>
                    <button class="history-new-btn mt-4">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Start New Conversation
                    </button>
                </div>
            `;
            return;
        }

        const chats = data.chats || [];
        if (chats.length === 0) {
            historyList.innerHTML = `
                <div class="history-state-container">
                    <div class="history-state-icon">📝</div>
                    <div class="history-state-title">No recent chats found</div>
                    <div class="history-state-desc">Start a new conversation to see them here.</div>
                    <button class="history-new-btn mt-4">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Start New Conversation
                    </button>
                </div>
            `;
            return;
        }

        // Render chats
        let html = `
            <div class="history-action-container">
                <button class="history-new-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New Conversation
                </button>
            </div>
            <div class="history-list-group">
        `;

        chats.forEach(chat => {
            const safeTitle = chat.title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            html += `
                <div class="history-card" data-title="${safeTitle}">
                    <div class="history-card-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <div class="history-card-content">
                        <span class="history-card-title">${escapeHtml(chat.title)}</span>
                    </div>
                    <div class="history-card-arrow">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>
            `;
        });

        html += `</div>`;

        historyList.innerHTML = html;

    } catch (e) {
        historyList.innerHTML = `
            <div class="history-state-container">
                <div class="history-state-icon">🔌</div>
                <div class="history-state-title">Connection Error</div>
                <div class="history-state-desc">Failed to reach the server.</div>
            </div>
        `;
    }
}


function hideChatHistory() {
    historyLayer.classList.remove('show');
    // Send an escape key to Antigravity to close the History panel
    try {
        fetchWithAuth('/close-history', { method: 'POST' });
    } catch (e) {
        console.error('Failed to close history on desktop:', e);
    }
}

historyBtn.addEventListener('click', showChatHistory);

// --- Select Chat from History ---
async function selectChat(title) {
    // Visual reset while desktop switches conversation
    chatContent.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Switching Conversation...</p></div>';

    try {
        const res = await fetchWithAuth('/select-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        const data = await res.json();

        if (data.success) {
            // Persistent polling to catch delayed desktop render/update
            let attempts = 0;
            const poll = setInterval(async () => {
                await loadSnapshot();
                attempts++;
                if (attempts > 10) clearInterval(poll);
            }, 500);
        } else {
            console.error('Failed to select chat:', data.error);
            setTimeout(loadSnapshot, 500);
        }
    } catch (e) {
        console.error('Select chat error:', e);
        setTimeout(loadSnapshot, 500);
    }
}

// --- Check Chat Status ---
async function checkChatStatus() {
    try {
        const res = await fetchWithAuth('/chat-status');
        const data = await res.json();

        chatIsOpen = data.hasChat || data.editorFound;

        if (!chatIsOpen) {
            showEmptyState();
        }
    } catch (e) {
        console.error('Chat status check failed:', e);
    }
}

// --- Empty State (No Chat Open) ---
function showEmptyState() {
    chatContent.innerHTML = `
        <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                <line x1="9" y1="10" x2="15" y2="10"></line>
            </svg>
            <h2>No Chat Open</h2>
            <p>Start a new conversation or select one from your history to begin chatting.</p>
            <button class="empty-state-btn" id="newChatFromEmptyBtn">
                Start New Conversation
            </button>
        </div>
    `;
}

// --- Utility: Escape HTML ---
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Settings Logic ---


function openModal(title, options, onSelect) {
    modalTitle.textContent = title;
    modalList.innerHTML = '';
    options.forEach(opt => {
        const div = document.createElement('div');
        div.className = 'modal-option';
        div.textContent = opt;
        div.addEventListener('click', () => {
            onSelect(opt);
            closeModal();
        });
        modalList.appendChild(div);
    });
    modalOverlay.classList.add('show');
}

function closeModal() {
    modalOverlay.classList.remove('show');
}

modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
};

modeBtn.addEventListener('click', () => {
    openModal('Select Mode', ['Fast', 'Planning'], async (mode) => {
        modeText.textContent = 'Setting...';
        try {
            const res = await fetchWithAuth('/set-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
            const data = await res.json();
            if (data.success) {
                currentMode = mode;
                modeText.textContent = mode;
                modeBtn.classList.toggle('active', mode === 'Planning');
            } else {
                alert('Error: ' + (data.error || 'Unknown'));
                modeText.textContent = currentMode;
            }
        } catch (e) {
            modeText.textContent = currentMode;
        }
    });
});

modelBtn.addEventListener('click', () => {
    openModal('Select Model', MODELS, async (model) => {
        const prev = modelText.textContent;
        modelText.textContent = 'Setting...';
        try {
            const res = await fetchWithAuth('/set-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model })
            });
            const data = await res.json();
            if (data.success) {
                modelText.textContent = model;
            } else {
                alert('Error: ' + (data.error || 'Unknown'));
                modelText.textContent = prev;
            }
        } catch (e) {
            modelText.textContent = prev;
        }
    });
});

// --- Viewport / Keyboard Handling ---
// This fixes the issue where the keyboard hides the input or layout breaks
if (window.visualViewport) {
    function handleResize() {
        // Resize the body to match the visual viewport (screen minus keyboard)
        document.body.style.height = window.visualViewport.height + 'px';

        // Scroll to bottom if keyboard opened
        if (document.activeElement === messageInput) {
            setTimeout(scrollToBottom, 100);
        }
    }

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize(); // Init
} else {
    // Fallback for older browsers without visualViewport support
    window.addEventListener('resize', () => {
        document.body.style.height = window.innerHeight + 'px';
    });
    document.body.style.height = window.innerHeight + 'px'; // Init
}

// --- Remote Click Logic (Thinking/Thought) ---
chatContainer.addEventListener('click', async (e) => {
    // Strategy: Check if the clicked element OR its parent contains "Thought" or "Thinking" text.
    // This handles both opening (collapsed) and closing (expanded) states.

    // 1. Find the nearest container that might be the "Thought" block
    const target = e.target.closest('div, span, p, summary, button, details');
    if (!target) return;

    const text = target.innerText || '';

    // Check if this looks like a clickable UI toggle from Antigravity/Cascade
    // Includes: Thought blocks, Worked status, Edited files status, and File lists
    const isUiToggle = /Thought|Thinking|Worked for|Edited|\d+\s+file/i.test(text) && text.length < 500;

    if (isUiToggle) {
        // Visual feedback - briefly dim the clicked element
        target.style.opacity = '0.5';
        setTimeout(() => target.style.opacity = '1', 300);

        // Extract just the first line for matching
        const firstLine = text.split('\n')[0].trim();

        // Determine which occurrence of this text the user tapped
        // This handles multiple Thought blocks with identical labels
        const allElements = chatContainer.querySelectorAll(target.tagName.toLowerCase());
        let tapIndex = 0;
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const elText = el.innerText || '';
            const elFirstLine = elText.split('\n')[0].trim();

            // Only count if it looks like a UI toggle and matches the first line exactly
            if (/Thought|Thinking|Worked for|Edited|\d+\s+file/i.test(elText) && elText.length < 500 && elFirstLine === firstLine) {
                // If this is our target (or contains it), we've found the correct index
                if (el === target || el.contains(target)) {
                    break;
                }
                tapIndex++;
            }
        }

        try {
            const response = await fetchWithAuth('/remote-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selector: target.tagName.toLowerCase(),
                    index: tapIndex,
                    textContent: firstLine  // Use first line for more reliable matching
                })
            });

            // Reload snapshot multiple times to catch the UI change
            // Desktop animation takes time, so we poll a few times
            setTimeout(loadSnapshot, 400);   // Quick check
            setTimeout(loadSnapshot, 800);   // After animation starts
            setTimeout(loadSnapshot, 1500);  // After animation completes
        } catch (e) {
            console.error('Remote click failed:', e);
        }
        return;
    }

    // --- Command Action Buttons (Run, Reject, Allow, Deny, etc.) ---
    const btn = e.target.closest('button, [role="button"]');
    if (btn) {
        const btnText = (btn.innerText || '').trim();

        // Match various action keywords
        const actionKeywords = [
            'Allow this conversation', 'Always allow', 'Allow once',
            'Review changes', 'Review',
            'Confirm', 'Accept', 'Reject', 'Discard',
            'Allow', 'Deny', 'Apply', 'Save', 'Run',
            'Yes', 'No'
        ];

        const btnTextLower = btnText.toLowerCase();
        const matchedKeyword = actionKeywords.find(kw =>
            btnTextLower.includes(kw.toLowerCase())
        );
        if (matchedKeyword) {
            btn.style.opacity = '0.5';
            setTimeout(() => btn.style.opacity = '1', 300);

            // Determine which occurrence of this button text the user tapped
            const allButtons = Array.from(chatContainer.querySelectorAll('button, [role="button"]'));

            // Filter to only those that match our specific keyword
            const matchingButtons = allButtons.filter(b =>
                (b.innerText || '').toLowerCase().includes(matchedKeyword.toLowerCase())
            );
            const btnIndex = matchingButtons.indexOf(btn);

            try {
                await fetchWithAuth('/remote-click', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        selector: btn.tagName.toLowerCase() === 'button' ? 'button' : '[role="button"]',
                        index: btnIndex >= 0 ? btnIndex : 0,
                        textContent: matchedKeyword
                    })
                });

                // Rapidly poll for updates as actions usually trigger DOM changes
                setTimeout(loadSnapshot, 400);
                setTimeout(loadSnapshot, 1000);
                setTimeout(loadSnapshot, 2500);
            } catch (err) {
                console.error('Remote button click failed:', err);
            }
        }
    }
});

// --- Initial Event Listeners (Refactored from inline) ---
if (enableHttpsBtn) enableHttpsBtn.addEventListener('click', enableHttps);
if (dismissSslBtn) dismissSslBtn.addEventListener('click', dismissSslBanner);
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (backHistoryBtn) backHistoryBtn.addEventListener('click', hideChatHistory);

quickActionChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const actionText = chip.getAttribute('data-action') || chip.innerText.trim();
        // Handle specific cases if needed, otherwise just pass the text
        if (actionText.includes('Explain')) {
            quickAction('Explain this code in detailed and elaborate manner.');
        } else if (actionText.includes('Fix')) {
            quickAction('Please fix the bugs in this code...');
        } else if (actionText.includes('Create')) {
            quickAction('Please create or update documentation for this code.');
        } else {
            quickAction(actionText);
        }
    });
});

// Delegation for dynamic history items
if (historyList) {
    historyList.addEventListener('click', (e) => {
        const newBtn = e.target.closest('.history-new-btn');
        const card = e.target.closest('.history-card');
        
        if (newBtn) {
            hideChatHistory();
            startNewChat();
        } else if (card) {
            const title = card.getAttribute('data-title');
            hideChatHistory();
            selectChat(title);
        }
    });
}

// Delegation for empty state
chatContent.addEventListener('click', (e) => {
    if (e.target.closest('#newChatFromEmptyBtn')) {
        startNewChat();
    }
});

// ==========================================
// WORKSPACE SWITCHER LOGIC
// ==========================================
const workspaceBar = document.getElementById('workspaceBar');
const workspaceName = document.getElementById('workspaceName');
const workspaceCount = document.getElementById('workspaceCount');
const workspaceSwitchBtn = document.getElementById('workspaceSwitchBtn');
const workspaceDrawer = document.getElementById('workspaceDrawer');
const workspaceDrawerOverlay = document.getElementById('workspaceDrawerOverlay');
const workspaceDrawerClose = document.getElementById('workspaceDrawerClose');
const workspaceDrawerList = document.getElementById('workspaceDrawerList');

let currentWorkspaces = [];

// Fetch workspace list from server
async function fetchWorkspaces() {
    try {
        const res = await fetchWithAuth('/workspaces');
        const data = await res.json();
        currentWorkspaces = data.workspaces || [];

        // Update indicator bar
        const active = currentWorkspaces.find(w => w.active);
        if (active) {
            workspaceName.textContent = active.title || `Port ${active.port}`;
            workspaceBar.classList.remove('no-connection');
        } else if (currentWorkspaces.length > 0) {
            workspaceName.textContent = 'No active workspace';
            workspaceBar.classList.add('no-connection');
        } else {
            workspaceName.textContent = 'Searching for workspaces...';
            workspaceBar.classList.add('no-connection');
        }

        // Update count badge
        workspaceCount.textContent = currentWorkspaces.length;

        return data;
    } catch (e) {
        console.error('[WORKSPACE] Failed to fetch workspaces:', e);
        workspaceName.textContent = 'Connection error';
        workspaceBar.classList.add('no-connection');
        return null;
    }
}

// Render workspace list in drawer
function renderWorkspaceDrawer() {
    if (currentWorkspaces.length === 0) {
        workspaceDrawerList.innerHTML = `
            <div class="workspace-empty">
                <div class="workspace-empty-icon">🔍</div>
                <div class="workspace-empty-text">No Workspaces Found</div>
                <div class="workspace-empty-desc">Launch Antigravity with --remote-debugging-port=9000 to connect.</div>
            </div>
        `;
        return;
    }

    // Color palette for workspace icons
    const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

    let html = '';
    currentWorkspaces.forEach((ws, index) => {
        const isActive = ws.active;
        const color = colors[index % colors.length];
        const initial = (ws.title || 'W').charAt(0).toUpperCase();

        html += `
            <div class="workspace-item ${isActive ? 'active' : ''}" data-port="${ws.port}">
                <div class="workspace-item-icon" style="color: ${color}; border-color: ${color}33;">
                    ${initial}
                </div>
                <div class="workspace-item-info">
                    <div class="workspace-item-title">${escapeHtml(ws.title || 'Unknown')}</div>
                    <div class="workspace-item-port">Port ${ws.port}</div>
                </div>
                <div class="workspace-item-status ${ws.connected ? 'connected' : 'disconnected'}"></div>
                ${isActive ? '<span class="workspace-item-badge">Active</span>' : ''}
            </div>
        `;
    });

    workspaceDrawerList.innerHTML = html;
}

// Open workspace drawer
function openWorkspaceDrawer() {
    fetchWorkspaces().then(() => {
        renderWorkspaceDrawer();
        workspaceDrawer.classList.add('show');
        workspaceDrawerOverlay.classList.add('show');
    });
}

// Close workspace drawer
function closeWorkspaceDrawer() {
    workspaceDrawer.classList.remove('show');
    workspaceDrawerOverlay.classList.remove('show');
}

// Switch workspace
async function switchWorkspace(port) {
    try {
        const res = await fetchWithAuth('/switch-workspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ port })
        });
        const data = await res.json();

        if (data.success) {
            console.log('[WORKSPACE] Switched to:', data.title);
            workspaceName.textContent = data.title;
            workspaceBar.classList.remove('no-connection');

            // Close drawer
            closeWorkspaceDrawer();

            // Show loading state and refresh
            chatContent.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading workspace...</p></div>';

            // Refresh everything
            setTimeout(loadSnapshot, 300);
            setTimeout(loadSnapshot, 800);
            setTimeout(fetchAppState, 500);
            setTimeout(checkChatStatus, 1000);

            // Re-fetch workspaces to update active status
            setTimeout(fetchWorkspaces, 200);
        } else {
            console.error('[WORKSPACE] Switch failed:', data.error);
        }
    } catch (e) {
        console.error('[WORKSPACE] Switch error:', e);
    }
}

// Event Listeners
workspaceSwitchBtn.addEventListener('click', openWorkspaceDrawer);
workspaceDrawerClose.addEventListener('click', closeWorkspaceDrawer);
workspaceDrawerOverlay.addEventListener('click', closeWorkspaceDrawer);

// Delegate clicks on workspace items
workspaceDrawerList.addEventListener('click', (e) => {
    const item = e.target.closest('.workspace-item');
    if (item) {
        const port = parseInt(item.getAttribute('data-port'));
        if (port) switchWorkspace(port);
    }
});

// --- Init ---
function initDeviceStats() {
    const dvcOs = document.getElementById('dvcOs');
    const dvcBrowser = document.getElementById('dvcBrowser');
    
    if (dvcOs) {
        const ua = navigator.userAgent;
        let os = "UNKNOWN";
        if (ua.indexOf("Win") != -1) os = "WINDOWS";
        if (ua.indexOf("Mac") != -1) os = "MACOS";
        if (ua.indexOf("Linux") != -1) os = "LINUX";
        if (ua.indexOf("Android") != -1) os = "ANDROID";
        if (ua.indexOf("like Mac") != -1) os = "IOS";
        dvcOs.textContent = os;
    }
    if (dvcBrowser) {
        const ua = navigator.userAgent;
        let b = "UNKNOWN";
        if (ua.indexOf("Chrome") != -1) b = "CHROME";
        if (ua.indexOf("Firefox") != -1) b = "FIREFOX";
        if (ua.indexOf("Safari") != -1 && ua.indexOf("Chrome") == -1) b = "SAFARI";
        dvcBrowser.textContent = b;
    }

    const uptime = document.getElementById('dvcUptime');
    if(uptime) {
        const start = Date.now();
        setInterval(() => {
            const diff = Math.floor((Date.now() - start)/1000);
            const h = String(Math.floor(diff/3600)).padStart(2,'0');
            const m = String(Math.floor((diff%3600)/60)).padStart(2,'0');
            const s = String(diff%60).padStart(2,'0');
            uptime.textContent = `${h}:${m}:${s}`;
        }, 1000);
    }
}

// Override renderWorkspaces to draw into the SYNC panel table
function renderWorkspaces(workspaces) {
    const syncContent = document.getElementById('syncContent');
    if (!syncContent) return; // UI element doesn't exist
    
    // Build tabular format
    let html = `<div class="table-header"><span>WORKSPACE NAME</span><span>PORT</span></div>`;
    
    if (workspaces.length === 0) {
        html += `<div class="data-row"><span class="value error">NO WORKSPACES DETECTED</span><span></span></div>`;
    } else {
        workspaces.forEach(ws => {
            const isTarget = ws.port === targetPort;
            const style = isTarget ? 'color: var(--accent-amber); font-weight: bold;' : '';
            html += `
            <div class="data-row" style="cursor: pointer; ${style}" onclick="switchWorkspace(${ws.port})">
                <span>${isTarget ? '> ' : ''}${ws.name}</span>
                <span class="value">${ws.port}</span>
            </div>
            `;
            
            if (isTarget) {
                const wName = document.getElementById('workspaceName');
                const wPort = document.getElementById('workspacePort');
                if (wName) wName.textContent = ws.name.toUpperCase();
                if (wPort) wPort.textContent = ws.port;
            }
        });
    }
    syncContent.innerHTML = html;
}

initDeviceStats();

// ==========================================
// TOOLS ROW LOGIC (Media / Mentions / Workflows)
// ==========================================
const toolMedia = document.getElementById('toolMedia');
const toolMentions = document.getElementById('toolMentions');
const toolWorkflows = document.getElementById('toolWorkflows');

// --- MEDIA: Upload file and insert path into chat ---
// Hidden file input for media picker
const mediaFileInput = document.createElement('input');
mediaFileInput.type = 'file';
mediaFileInput.accept = 'image/*,video/*,.pdf,.txt,.md,.js,.py,.ts,.json,.csv';
mediaFileInput.style.display = 'none';
mediaFileInput.multiple = true;
document.body.appendChild(mediaFileInput);

if (toolMedia) {
    toolMedia.addEventListener('click', () => {
        mediaFileInput.click();
    });
}

mediaFileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    toolMedia.classList.add('active');
    toolMedia.textContent = 'UPLOADING...';

    try {
        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }

        const res = await fetchWithAuth('/upload-media', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success && data.paths) {
            // Insert file paths into the message input
            const pathsText = data.paths.join('\n');
            const prefix = messageInput.value ? messageInput.value + '\n' : '';
            messageInput.value = prefix + pathsText;
            messageInput.focus();
            // Auto-resize textarea
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        } else {
            console.error('Upload failed:', data.error);
        }
    } catch (err) {
        console.error('Upload error:', err);
    }

    // Reset
    toolMedia.classList.remove('active');
    toolMedia.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg> MEDIA`;
    mediaFileInput.value = '';
});

// --- MENTIONS: Insert @ into input ---
if (toolMentions) {
    toolMentions.addEventListener('click', () => {
        const pos = messageInput.selectionStart || messageInput.value.length;
        const before = messageInput.value.slice(0, pos);
        const after = messageInput.value.slice(pos);
        messageInput.value = before + '@' + after;
        messageInput.focus();
        messageInput.selectionStart = messageInput.selectionEnd = pos + 1;
    });
}

// --- WORKFLOWS: Insert workflow command ---
if (toolWorkflows) {
    toolWorkflows.addEventListener('click', () => {
        messageInput.value = 'Create a task checklist for this conversation. List all pending items with checkboxes.';
        messageInput.focus();
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });
}

connectWebSocket();
fetchAppState();
setInterval(fetchAppState, 5000);
checkChatStatus();
setInterval(checkChatStatus, 10000);
fetchWorkspaces();
setInterval(fetchWorkspaces, 5000);
