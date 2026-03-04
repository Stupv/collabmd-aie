// CollabMD — Realtime Collaborative Markdown Editor

// ===== DEFAULT CONTENT =====
const DEFAULT_CONTENT = `# Welcome to CollabMD \u{1F680}

A realtime collaborative markdown editor. Share the URL to start writing together!

## Features
- **Realtime collaboration** with live cursors
- **Mermaid diagrams** for visual documentation
- **Syntax highlighting** in code blocks
- **GitHub-flavored** markdown support

## Example Diagram

\`\`\`mermaid
graph TD
    A[Open CollabMD] -->|Share Link| B[Invite Collaborators]
    B --> C{Edit Together}
    C --> D[Write Markdown]
    C --> E[Create Diagrams]
    C --> F[Add Code Blocks]
    D --> G[Live Preview]
    E --> G
    F --> G
\`\`\`

## Code Example

\`\`\`javascript
function hello() {
  console.log("Hello, CollabMD!");
}
\`\`\`

| Feature | Status | Description | Platform | Version | Notes |
|---------|--------|-------------|----------|---------|-------|
| Realtime editing | \u2705 | Collaborate with multiple users in real time | Web | 1.0 | Powered by Yjs CRDT |
| Mermaid diagrams | \u2705 | Render flowcharts, sequence diagrams, and more | Web | 1.0 | Mermaid v11 |
| Code highlighting | \u2705 | Syntax highlighting for 100+ languages | Web | 1.0 | Highlight.js |
| Dark mode | \u2705 | Toggle between light and dark themes | Web | 1.0 | System-aware |

> "The best way to write documentation is together." \u2014 CollabMD
`;

// ===== UTILITY FUNCTIONS =====

function generateRoomId() {
  const adjectives = ['swift','bright','calm','deep','quick','warm','bold','keen','neat','vast'];
  const nouns = ['note','page','doc','draft','memo','plan','idea','mark','text','code'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999);
  return `${adj}-${noun}-${num}`;
}

function generateUserName() {
  const names = ['Alice','Bob','Charlie','Dana','Eve','Frank','Grace','Hank','Iris','Jack','Kim','Leo','Maya','Nate','Olivia','Pete','Quinn','Ruby','Sam','Tara'];
  return names[Math.floor(Math.random() * names.length)];
}

function generateUserColor() {
  const colors = [
    '#ef4444','#f97316','#eab308','#22c55e','#06b6d4',
    '#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f59e0b',
    '#6366f1','#10b981','#f43f5e','#0ea5e9','#a855f7'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function showToast(message, duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}


// ===== THEME =====

let currentTheme = 'dark';

function initTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon();
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon();

  // Update highlight.js theme
  const link = document.getElementById('hljs-theme');
  if (link) {
    link.href = currentTheme === 'dark'
      ? 'https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css'
      : 'https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github.min.css';
  }

  // Re-init mermaid for theme
  initMermaidTheme();
  renderPreview();
}

function updateThemeIcon() {
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.innerHTML = currentTheme === 'dark'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  });
}

function initMermaidTheme() {
  if (!window.mermaid) return;
  const isDark = currentTheme === 'dark';
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark ? {
      primaryColor: '#818cf8',
      primaryTextColor: '#e2e2ea',
      primaryBorderColor: '#383a50',
      lineColor: '#8b8ba0',
      secondaryColor: '#1c1e2c',
      tertiaryColor: '#161822',
      background: '#161822',
      mainBkg: '#1c1e2c',
      nodeBorder: '#383a50',
      clusterBkg: '#1a1c28',
      titleColor: '#e2e2ea',
      edgeLabelBackground: '#161822'
    } : {}
  });
}


// ===== MARKDOWN RENDERER =====

let md;
let mermaidCounter = 0;

function initMarkdown() {
  if (!window.markdownit) {
    console.warn('markdown-it not loaded yet, retrying...');
    setTimeout(initMarkdown, 500);
    return;
  }
  md = window.markdownit({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function(str, lang) {
      if (lang === 'mermaid') return '';
      if (window.hljs) {
        if (lang && hljs.getLanguage(lang)) {
          try { return hljs.highlight(str, { language: lang }).value; } catch (_) {}
        }
        try { return hljs.highlightAuto(str).value; } catch (_) {}
      }
      return '';
    }
  });

  // Override fence for mermaid
  const defaultFence = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.fence = function(tokens, idx, options, env, self) {
    const token = tokens[idx];
    const info = token.info ? token.info.trim().toLowerCase() : '';
    if (info === 'mermaid') {
      mermaidCounter++;
      return `<div class="mermaid" id="mermaid-${mermaidCounter}">${md.utils.escapeHtml(token.content)}</div>`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };

  // Task list support
  md.renderer.rules.list_item_open = function(tokens, idx, options, env, self) {
    if (idx + 2 < tokens.length) {
      const inlineToken = tokens[idx + 2];
      if (inlineToken && inlineToken.content) {
        const c = inlineToken.content;
        if (c.startsWith('[ ] ') || c.startsWith('[x] ') || c.startsWith('[X] ')) {
          return '<li class="task-list-item">';
        }
      }
    }
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.text = function(tokens, idx) {
    let content = tokens[idx].content;
    if (content.startsWith('[x] ') || content.startsWith('[X] ')) {
      return '<input type="checkbox" checked disabled> ' + md.utils.escapeHtml(content.slice(4));
    }
    if (content.startsWith('[ ] ')) {
      return '<input type="checkbox" disabled> ' + md.utils.escapeHtml(content.slice(4));
    }
    return md.utils.escapeHtml(content);
  };

  // Make links open in new tab
  const defaultLinkOpen = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
  md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
    return defaultLinkOpen(tokens, idx, options, env, self);
  };
}

let renderTimeout = null;
let renderDebounce = null;

function renderPreview() {
  // Debounce to avoid rendering on every keystroke
  if (renderDebounce) clearTimeout(renderDebounce);
  if (renderTimeout) cancelAnimationFrame(renderTimeout);

  renderDebounce = setTimeout(() => {
    renderTimeout = requestAnimationFrame(async () => {
      // Prefer reading from Yjs text directly (most reliable source)
      // Fall back to CodeMirror editor state
      let text = '';
      if (ytextRef) {
        text = ytextRef.toString();
      } else if (editorView) {
        text = editorView.state.doc.toString();
      }

      // If markdown-it is not loaded yet, retry after a delay
      if (!md) {
        initMarkdown();
        if (!md) {
          setTimeout(renderPreview, 500);
          return;
        }
      }

      mermaidCounter = 0;
      const html = md.render(text);
      const el = document.getElementById('previewContent');
      if (!el) return;
      el.innerHTML = html;

      // Wrap tables in scrollable container for horizontal scroll
      el.querySelectorAll('table').forEach(table => {
        if (!table.parentElement.classList.contains('table-wrapper')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'table-wrapper';
          table.parentNode.insertBefore(wrapper, table);
          wrapper.appendChild(table);
        }
      });

      // Render mermaid diagrams (Mermaid v11 is async)
      const mermaidDivs = el.querySelectorAll('.mermaid');
      if (mermaidDivs.length > 0 && window.mermaid) {
        try {
          await mermaid.run({ nodes: mermaidDivs });
        } catch (e) {
          console.warn('Mermaid render:', e);
        }
      }
      // Update outline after render
      updateOutline();
    });
  }, 100);
}


// ===== OUTLINE =====

let outlineOpen = false;
let outlineObserver = null;
let activeHeadingId = null;

function toggleOutline() {
  outlineOpen = !outlineOpen;
  const panel = document.getElementById('outlinePanel');
  const btn = document.getElementById('outlineToggle');
  if (panel) panel.classList.toggle('hidden', !outlineOpen);
  if (btn) btn.classList.toggle('active', outlineOpen);
  if (outlineOpen) updateOutline();
}

function updateOutline() {
  const nav = document.getElementById('outlineNav');
  const el = document.getElementById('previewContent');
  if (!nav || !el) return;

  const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6');

  if (headings.length === 0) {
    nav.innerHTML = '<div class="outline-empty">No headings found</div>';
    cleanupOutlineObserver();
    return;
  }

  // Assign IDs to headings for scroll targeting
  const items = [];
  headings.forEach((h, i) => {
    if (!h.id) {
      h.id = 'heading-' + i + '-' + h.textContent.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    }
    items.push({
      id: h.id,
      level: parseInt(h.tagName[1]),
      text: h.textContent.trim()
    });
  });

  // Build outline HTML
  nav.innerHTML = items.map(item =>
    `<button class="outline-item" data-level="${item.level}" data-target="${item.id}" title="${item.text.replace(/"/g, '&quot;')}">${item.text}</button>`
  ).join('');

  // Click handlers
  nav.querySelectorAll('.outline-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        const container = document.getElementById('previewContainer');
        if (container) {
          const offset = target.offsetTop - 12;
          container.scrollTo({ top: offset, behavior: 'smooth' });
        }
        // Set active immediately on click
        setActiveOutlineItem(btn.dataset.target);
      }
    });
  });

  // Setup IntersectionObserver for active tracking
  setupOutlineObserver(headings);
}

function setActiveOutlineItem(id) {
  activeHeadingId = id;
  const nav = document.getElementById('outlineNav');
  if (!nav) return;
  nav.querySelectorAll('.outline-item').forEach(item => {
    item.classList.toggle('active', item.dataset.target === id);
  });

  // Scroll the active item into view within the outline nav
  const activeItem = nav.querySelector('.outline-item.active');
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function cleanupOutlineObserver() {
  if (outlineObserver) {
    outlineObserver.disconnect();
    outlineObserver = null;
  }
}

function setupOutlineObserver(headings) {
  cleanupOutlineObserver();

  const container = document.getElementById('previewContainer');
  if (!container || headings.length === 0) return;

  // Use a top-biased rootMargin: detect headings near the top of the viewport
  outlineObserver = new IntersectionObserver(
    (entries) => {
      // Find the topmost visible heading
      let topEntry = null;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
            topEntry = entry;
          }
        }
      });
      if (topEntry) {
        setActiveOutlineItem(topEntry.target.id);
      }
    },
    {
      root: container,
      rootMargin: '0px 0px -70% 0px',
      threshold: 0
    }
  );

  headings.forEach(h => outlineObserver.observe(h));
}


// ===== VIEW MODE =====

let currentView = 'split';
let mobileShowEditor = true;

function setView(view) {
  currentView = view;
  const layout = document.getElementById('editorLayout');
  if (layout) layout.setAttribute('data-view', view);

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (editorView && (view === 'split' || view === 'editor')) {
    setTimeout(() => editorView.requestMeasure(), 50);
  }
}

function toggleMobileView() {
  mobileShowEditor = !mobileShowEditor;
  const layout = document.getElementById('editorLayout');
  if (!layout) return;

  if (mobileShowEditor) {
    layout.setAttribute('data-view', 'split'); // split on mobile shows editor only
    updateMobileToggleBtn('Preview');
  } else {
    layout.setAttribute('data-view', 'preview');
    updateMobileToggleBtn('Editor');
  }

  if (editorView && mobileShowEditor) {
    setTimeout(() => editorView.requestMeasure(), 50);
  }
}

function updateMobileToggleBtn(label) {
  const btn = document.getElementById('mobileViewToggle');
  if (!btn) return;
  const isPreview = label === 'Editor';
  btn.innerHTML = isPreview
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="14" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg><span class="toolbar-btn-label">' + label + '</span>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span class="toolbar-btn-label">' + label + '</span>';
}


// ===== RESIZER =====

function initResizer() {
  const resizer = document.getElementById('resizer');
  const layout = document.getElementById('editorLayout');
  const editorPane = document.getElementById('editorPane');

  if (!resizer || !layout || !editorPane) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = editorPane.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = e.clientX - startX;
    const totalWidth = layout.offsetWidth;
    const newWidth = Math.max(200, Math.min(totalWidth - 200, startWidth + delta));
    const pct = (newWidth / totalWidth) * 100;
    editorPane.style.flex = `0 0 ${pct}%`;
    document.getElementById('previewPane').style.flex = '1';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (editorView) editorView.requestMeasure();
  });
}


// ===== CODEMIRROR + YJS =====

let editorView = null;
let ydoc = null;
let provider = null;
let ytextRef = null;

// Server URLs — ordered by preference
// 1. Local server (user runs `npm start` or `node server.js`)
// 2. Public demo server (may be unreliable/down)
const WS_SERVERS = [
  { url: `ws://localhost:1234`, label: 'local server', healthCheck: 'http://localhost:1234' },
  { url: 'wss://demos.yjs.dev/ws', label: 'public server', healthCheck: null },
];

// Custom URL from query param: ?server=ws://myserver.com
function getCustomServerUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('server');
}

// Probe whether a local WebSocket server is reachable via HTTP health check
async function probeServer(healthUrl, timeoutMs = 1500) {
  if (!healthUrl) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(healthUrl, { signal: controller.signal, mode: 'no-cors' });
    clearTimeout(timer);
    return true; // any response means the server is up
  } catch {
    return false;
  }
}

// Resolve the best available server URL
async function resolveServerUrl() {
  const custom = getCustomServerUrl();
  if (custom) return { url: custom, label: 'custom server' };

  // Try local server first
  const local = WS_SERVERS[0];
  if (local.healthCheck) {
    const ok = await probeServer(local.healthCheck);
    if (ok) return local;
  }

  // Fall back to public server
  return WS_SERVERS[1];
}

async function initEditor(roomId) {
  // Show loading
  const loadingEl = document.getElementById('editorLoading');

  try {
    const [
      { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, crosshairCursor, highlightSpecialChars },
      { EditorState },
      { defaultKeymap, history, historyKeymap, indentWithTab },
      { markdown, markdownLanguage },
      { languages },
      { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter, foldKeymap },
      { oneDark },
      { closeBrackets, closeBracketsKeymap, autocompletion },
      { searchKeymap, highlightSelectionMatches },
      Y,
      { WebsocketProvider },
      { yCollab }
    ] = await Promise.all([
      import('@codemirror/view'),
      import('@codemirror/state'),
      import('@codemirror/commands'),
      import('@codemirror/lang-markdown'),
      import('@codemirror/language-data'),
      import('@codemirror/language'),
      import('@codemirror/theme-one-dark'),
      import('@codemirror/autocomplete'),
      import('@codemirror/search'),
      import('yjs'),
      import('y-websocket'),
      import('y-codemirror.next')
    ]);

    // Create Yjs document
    ydoc = new Y.Doc();
    const ytext = ydoc.getText('codemirror');
    ytextRef = ytext;

    // Yjs undo manager for collaborative undo/redo
    const undoManager = new Y.UndoManager(ytext);

    // WebSocket provider for collaboration
    const userName = generateUserName();
    const userColor = generateUserColor();

    // Resolve the best available server
    const server = await resolveServerUrl();
    console.log(`[CollabMD] Connecting to ${server.label}: ${server.url}`);

    provider = new WebsocketProvider(
      server.url,
      `collabmd-${roomId}`,
      ydoc,
      { disableBc: true, maxBackoffTime: 5000 }
    );

    // Show connection status
    let wasConnected = false;
    let connectionAttempts = 0;
    const maxAttemptsBeforeWarning = 3;

    provider.on('status', ({ status }) => {
      const badge = document.getElementById('userCount');
      if (!badge) return;
      if (status === 'connecting') {
        connectionAttempts++;
        badge.textContent = wasConnected ? 'Reconnecting...' : 'Connecting...';
        badge.style.opacity = '0.6';
        // After multiple failed attempts, show guidance
        if (!wasConnected && connectionAttempts >= maxAttemptsBeforeWarning) {
          badge.textContent = 'Server unreachable';
          showToast(`Cannot reach ${server.label}. Run "npm start" locally for collaboration.`, 6000);
        }
      } else if (status === 'connected') {
        connectionAttempts = 0;
        badge.style.opacity = '1';
        if (!wasConnected) showToast(`Connected to ${server.label}`);
        wasConnected = true;
        // Count will be updated by awareness change
      } else if (status === 'disconnected') {
        badge.textContent = 'Offline';
        badge.style.opacity = '0.6';
      }
    });

    const awareness = provider.awareness;
    awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
      colorLight: userColor + '33'
    });

    // Observe Yjs text changes to trigger preview rendering
    // This catches changes from remote peers AND programmatic insertions
    ytext.observe(() => {
      renderPreview();
    });

    // Default content for new rooms
    setTimeout(() => {
      if (ytext.toString() === '') {
        ydoc.transact(() => {
          ytext.insert(0, DEFAULT_CONTENT);
        });
      }
      // Always trigger an initial render after the default content timeout
      renderPreview();
    }, 2000);

    // Theme
    const collabTheme = EditorView.theme({
      '&': {
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
      },
      '.cm-content': {
        caretColor: 'var(--color-primary)',
        fontFamily: 'var(--font-mono)',
        padding: '16px 0',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text-faint)',
        borderRight: '1px solid var(--color-divider)',
        minWidth: '44px',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--color-surface-offset)',
        color: 'var(--color-text-muted)',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--color-surface-offset)',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--color-primary)',
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'var(--color-primary-highlight)',
      },
      '.cm-selectionMatch': {
        backgroundColor: 'var(--color-primary-highlight)',
      },
      '.cm-line': {
        padding: '0 16px',
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'var(--color-surface-dynamic)',
        border: 'none',
        color: 'var(--color-text-muted)',
      },
      '.cm-matchingBracket': {
        backgroundColor: 'var(--color-primary-highlight)',
        outline: '1px solid var(--color-primary)',
      }
    }, { dark: true });

    // Update listener
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) renderPreview();
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        const col = pos - line.from + 1;
        const el = document.getElementById('lineInfo');
        if (el) el.textContent = `Ln ${line.number}, Col ${col}`;
      }
    });

    // Build extensions
    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      foldGutter(),
      drawSelection(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...foldKeymap,
        indentWithTab,
      ]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      collabTheme,
      oneDark,
      yCollab(ytext, awareness, { undoManager }),
      updateListener,
      EditorView.lineWrapping,
    ];

    // Create editor view
    const container = document.getElementById('editorContainer');
    editorView = new EditorView({
      state: EditorState.create({ doc: ytext.toString(), extensions }),
      parent: container,
    });

    // Hide loading
    if (loadingEl) loadingEl.classList.add('hidden');

    // Awareness tracking
    awareness.on('change', () => updateUserIndicators(awareness));
    updateUserIndicators(awareness);

    // Initial render — try immediately and also after a delay
    renderPreview();
    setTimeout(renderPreview, 500);
    setTimeout(renderPreview, 1500);
    setTimeout(renderPreview, 3000);

    return { editorView, ydoc, provider };

  } catch (err) {
    console.error('Editor init failed:', err);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span class="loading-text" style="color:var(--color-error)">Failed to load editor modules</span>
        <button class="btn btn-secondary" onclick="location.reload()" style="margin-top:var(--space-2)">Retry</button>
      `;
    }
  }
}

function updateUserIndicators(awareness) {
  const states = awareness.getStates();
  const users = [];
  states.forEach((state, clientId) => {
    if (state.user) {
      users.push({ ...state.user, clientId, isLocal: clientId === awareness.clientID });
    }
  });

  // Count
  const countEl = document.getElementById('userCount');
  if (countEl) countEl.textContent = `${users.length} online`;

  // Avatars
  const avatarsEl = document.getElementById('userAvatars');
  if (!avatarsEl) return;
  avatarsEl.innerHTML = '';
  const show = users.slice(0, 5);
  show.forEach(user => {
    const el = document.createElement('div');
    el.className = 'user-avatar';
    el.style.backgroundColor = user.color;
    el.textContent = user.name.charAt(0).toUpperCase();
    el.title = user.name + (user.isLocal ? ' (you)' : '');
    avatarsEl.appendChild(el);
  });
  if (users.length > 5) {
    const el = document.createElement('div');
    el.className = 'user-avatar';
    el.style.backgroundColor = 'var(--color-surface-dynamic)';
    el.style.color = 'var(--color-text-muted)';
    el.textContent = `+${users.length - 5}`;
    avatarsEl.appendChild(el);
  }
}


// ===== ROUTING =====

function getRoomFromHash() {
  const match = window.location.hash.match(/room=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function navigateToRoom(roomId) {
  window.location.hash = `room=${encodeURIComponent(roomId)}`;
}

function cleanup() {
  if (provider) { provider.disconnect(); provider.destroy(); provider = null; }
  if (ydoc) { ydoc.destroy(); ydoc = null; }
  if (editorView) { editorView.destroy(); editorView = null; }
  ytextRef = null;
  cleanupOutlineObserver();
}

function showLanding() {
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('editor-page').classList.add('hidden');
  cleanup();
}

async function showEditor(roomId) {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('editor-page').classList.remove('hidden');

  // Reset loading state
  const loadingEl = document.getElementById('editorLoading');
  if (loadingEl) {
    loadingEl.classList.remove('hidden');
    loadingEl.innerHTML = '<div class="loading-spinner"></div><span class="loading-text">Loading editor...</span>';
  }

  // Room name
  const roomNameEl = document.getElementById('roomName');
  if (roomNameEl) roomNameEl.textContent = roomId;

  // Default view mode
  mobileShowEditor = true;
  updateMobileToggleBtn('Preview');

  try {
    await initEditor(roomId);
    setView(window.innerWidth <= 768 ? 'split' : 'split'); // split on mobile = editor
  } catch (err) {
    console.error('Editor load failed:', err);
    showToast('Failed to initialize editor.');
  }
}

function handleHashChange() {
  const roomId = getRoomFromHash();
  if (roomId) {
    showEditor(roomId);
  } else {
    showLanding();
  }
}


// ===== ENSURE CDN LIBRARIES =====

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function ensureLibraries() {
  const tasks = [];
  if (!window.markdownit) {
    tasks.push(
      loadScript('https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js')
        .catch(() => loadScript('https://unpkg.com/markdown-it@14/dist/markdown-it.min.js'))
    );
  }
  if (!window.hljs) {
    tasks.push(
      loadScript('https://cdn.jsdelivr.net/npm/highlight.js@11/highlight.min.js')
        .catch(() => loadScript('https://unpkg.com/@highlightjs/cdn-assets@11/highlight.min.js'))
    );
  }
  if (!window.mermaid) {
    tasks.push(
      loadScript('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js')
        .catch(() => loadScript('https://unpkg.com/mermaid@11/dist/mermaid.min.js'))
    );
  }
  if (tasks.length > 0) {
    try {
      await Promise.all(tasks);
    } catch (e) {
      console.warn('Some libraries failed to load:', e);
    }
  }
}


// ===== INIT =====

function init() {
  initTheme();

  // Ensure CDN libraries are loaded; if not, dynamically load them
  ensureLibraries().then(() => {
    initMarkdown();
    initMermaidTheme();
  });

  // Landing events
  document.getElementById('createRoomBtn').addEventListener('click', () => {
    navigateToRoom(generateRoomId());
  });

  document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const input = document.getElementById('roomInput');
    const val = input.value.trim();
    if (val) {
      navigateToRoom(val);
    } else {
      input.focus();
      showToast('Enter a room name to join');
    }
  });

  document.getElementById('roomInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('joinRoomBtn').click();
  });

  // Back
  document.getElementById('backToLanding').addEventListener('click', () => {
    window.location.hash = '';
  });

  // View toggles (desktop)
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  // Mobile view toggle
  document.getElementById('mobileViewToggle').addEventListener('click', toggleMobileView);

  // Outline toggle
  document.getElementById('outlineToggle').addEventListener('click', toggleOutline);

  // Theme toggles
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  // Share
  document.getElementById('shareBtn').addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Room link copied to clipboard');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('Room link copied'); } catch (_) { showToast('Could not copy link'); }
      ta.remove();
    });
  });

  // Resizer
  initResizer();

  // Routing
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();

  // Resize handler
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (editorView) editorView.requestMeasure();
    }, 100);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
