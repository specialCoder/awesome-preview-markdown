'use strict';

/* ==========================================================================
   Awesome Preview Markdown - viewer
   Rendering pipeline: marked (parse) -> DOMPurify (sanitize) -> highlight.js
   (code) -> mermaid (diagrams). Sync scrolling is driven by data-line
   anchors that the marked renderer attaches to every top level block.
   ========================================================================== */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const ui = {
  app: $('#app'),
  toolbar: $('#toolbar'),
  panes: $('#panes'),
  sourcePane: $('#source-pane'),
  sourceScroll: $('#source-scroll'),
  source: $('#source'),
  splitter: $('#splitter'),
  previewPane: $('#preview-pane'),
  previewScroll: $('#preview-scroll'),
  preview: $('#preview'),
  toc: $('#toc'),
  tocList: $('#toc-list'),
  empty: $('#empty'),
  banner: $('#banner'),
  toast: $('#toast'),
  stName: $('#st-name'),
  stMsg: $('#st-msg'),
  stPos: $('#st-pos'),
  stStats: $('#st-stats'),
  docLabel: $('#doc-label'),
  btnToc: $('#btn-toc'),
  btnTocClose: $('#btn-toc-close'),
  btnSync: $('#btn-sync'),
  btnTheme: $('#btn-theme'),
  btnFullscreen: $('#btn-fullscreen'),
  btnReload: $('#btn-reload'),
  layoutSeg: $('#layout-seg'),
  css: {
    mdLight: $('#md-css-light'),
    mdDark: $('#md-css-dark'),
    hlLight: $('#hl-css-light'),
    hlDark: $('#hl-css-dark')
  }
};

const state = {
  text: '',
  docUrl: '',
  docName: '',
  tabId: null,
  lastTs: 0,
  theme: 'light',
  layout: 'split',
  layoutSaved: false,
  layoutBeforeFullscreen: null,
  toc: true,
  tocSaved: false,
  sync: true,
  split: 50,
  mermaidSeq: 0,
  tocItems: [],
  activeToc: null
};

const sync = {
  srcTops: [],
  anchors: [],
  lineCount: 0,
  driver: null,
  releaseTimer: 0,
  measureFrame: 0
};

/* ---------------------------------------------------------------- storage */

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage;

const prefs = {
  async load() {
    if (!hasChrome) return;
    const saved = await chrome.storage.local.get(['theme', 'layout', 'toc', 'syncScroll', 'split']);
    if (saved.theme === 'light' || saved.theme === 'dark') state.theme = saved.theme;
    else if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) state.theme = 'dark';
    if (['source', 'split', 'preview'].includes(saved.layout)) {
      state.layout = saved.layout;
      state.layoutSaved = true;
    }
    if (typeof saved.toc === 'boolean') {
      state.toc = saved.toc;
      state.tocSaved = true;
    }
    if (typeof saved.syncScroll === 'boolean') state.sync = saved.syncScroll;
    if (typeof saved.split === 'number' && saved.split >= 20 && saved.split <= 80) state.split = saved.split;
  },
  save(patch) {
    if (hasChrome) chrome.storage.local.set(patch);
  }
};

/* ------------------------------------------------------------------ utils */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function nameFor(url) {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    if (u.protocol === 'file:') return last || u.href;
    return last ? `${last} · ${u.hostname}` : u.hostname;
  } catch {
    return url.slice(-60);
  }
}

/**
 * Runs inside the target tab. The browser is what opens documents (local or
 * remote); we only read back the plain text it rendered. Chrome shows plain
 * text documents as a single <pre> inside <body>.
 */
function readPageSource() {
  const body = document.body;
  if (!body) {
    return { text: '', looksPlain: false, url: location.href, title: document.title, contentType: '' };
  }
  const onlyPre = body.children.length === 1 && body.firstElementChild.tagName === 'PRE';
  const ct = (document.contentType || '').toLowerCase();
  const plainType = ct.startsWith('text/plain') || ct.startsWith('text/markdown') || ct === 'application/octet-stream';
  const looksPlain = onlyPre || plainType;
  const text = onlyPre ? body.firstElementChild.innerText : body.innerText;
  return { text, looksPlain, url: location.href, title: document.title, contentType: ct };
}

function toast(text) {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { ui.toast.hidden = true; }, 1600);
}

function showBanner(title, detail) {
  ui.banner.replaceChildren();
  const close = document.createElement('button');
  close.className = 'banner-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '\u00d7';
  close.addEventListener('click', hideBanner);
  const strong = document.createElement('strong');
  strong.textContent = title;
  ui.banner.append(close, strong, document.createTextNode(' ' + detail));
  ui.banner.hidden = false;
}

function hideBanner() {
  ui.banner.hidden = true;
  ui.banner.replaceChildren();
}

function setStatus(message, isError) {
  ui.stMsg.textContent = message || '';
  ui.stMsg.classList.toggle('is-error', !!isError);
}

/* ------------------------------------------------------- marked rendering */

const baseRenderer = new marked.Renderer();
let lineMap = new WeakMap();
let slugSeen = new Map();

function slugify(text) {
  let s = String(text).trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-');
  if (!s) s = 'section';
  const n = slugSeen.get(s) || 0;
  slugSeen.set(s, n + 1);
  return n === 0 ? s : `${s}-${n}`;
}

/** Attach data-line to the first tag of an already-rendered block. */
function tagLine(html, token) {
  const line = lineMap.get(token);
  if (line == null) return html;
  const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html);
  if (!m) return html;
  return `<${m[1]} data-line="${line}"${html.slice(m[0].length)}`;
}

/** Render a block with marked's own renderer, then stamp it with data-line. */
function wrapBlock(name) {
  return function (token) {
    baseRenderer.parser = this.parser;
    return tagLine(baseRenderer[name](token), token);
  };
}

function highlightCode(text, lang) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return { value: hljs.highlight(text, { language: lang, ignoreIllegals: true }).value, lang };
    } catch { /* fall back to auto detection */ }
  }
  if (text.length <= 4000) {
    try {
      const auto = hljs.highlightAuto(text);
      if (auto.language) return { value: auto.value, lang: auto.language };
    } catch { /* fall back to plain text */ }
  }
  return { value: escapeHtml(text), lang: lang || 'text' };
}

marked.use({
  gfm: true,
  breaks: false,
  pedantic: false,
  renderer: {
    heading(token) {
      const id = slugify(token.text);
      const line = lineMap.get(token);
      const inner = this.parser.parseInline(token.tokens);
      return `<h${token.depth} id="${id}" class="md-heading"${line != null ? ` data-line="${line}"` : ''}>`
        + `<a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${token.depth}>\n`;
    },

    code(token) {
      const langRaw = (token.lang || '').trim();
      const lang = langRaw.split(/\s+/)[0].toLowerCase();
      const line = lineMap.get(token);
      const dl = line != null ? ` data-line="${line}"` : '';

      if (lang === 'mermaid') {
        return `<div class="mermaid-block"${dl}>`
          + `<div class="mermaid-out"><div class="mermaid-pending">Rendering diagram\u2026</div></div>`
          + `<pre class="mermaid-src">${escapeHtml(token.text)}</pre></div>`;
      }

      const hl = highlightCode(token.text, lang);
      return `<div class="code-block"${dl}>`
        + `<div class="code-head"><span class="code-lang">${escapeHtml(hl.lang || 'text')}</span>`
        + `<button type="button" class="copy-btn" title="Copy code to clipboard">Copy</button></div>`
        + `<pre><code class="hljs language-${escapeHtml(hl.lang || 'text')}">${hl.value}</code></pre></div>`;
    },

    paragraph: wrapBlock('paragraph'),
    blockquote: wrapBlock('blockquote'),
    list: wrapBlock('list'),
    table: wrapBlock('table'),
    hr: wrapBlock('hr'),
    html: wrapBlock('html')
  }
});

/**
 * Map every token to its 0-based source line. Top-level raws are contiguous in
 * the source, so scanning forward with a cursor is exact; nested tokens are
 * located inside their parent's raw the same way.
 */
function buildLineMap(tokens, src) {
  lineMap = new WeakMap();
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);

  const lineAt = (offset) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return lo;
  };

  const childGroups = (t) => {
    const groups = [];
    if (Array.isArray(t.tokens)) groups.push(t.tokens);
    if (Array.isArray(t.items)) groups.push(t.items);
    if (Array.isArray(t.header)) groups.push(t.header);
    if (Array.isArray(t.rows)) for (const row of t.rows) if (Array.isArray(row)) groups.push(row);
    return groups;
  };

  const walk = (list, fromOffset) => {
    let cursor = fromOffset;
    for (const token of list) {
      const raw = token.raw || '';
      let idx = raw ? src.indexOf(raw, cursor) : -1;
      if (idx < 0) idx = cursor;
      lineMap.set(token, lineAt(idx));
      for (const group of childGroups(token)) walk(group, idx);
      cursor = idx + Math.max(raw.length, 1);
    }
  };

  walk(tokens, 0);
}

function markdownToHtml(text) {
  slugSeen = new Map();
  const tokens = marked.lexer(text);
  buildLineMap(tokens, text);
  return marked.parser(tokens);
}

function postProcess(root) {
  const base = state.docUrl ? (() => { try { return new URL(state.docUrl); } catch { return null; } })() : null;
  if (base) {
    for (const node of root.querySelectorAll('img[src], source[src], video[src], audio[src], a[href]')) {
      const attr = node.hasAttribute('src') ? 'src' : 'href';
      const value = node.getAttribute(attr) || '';
      if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('#') || value.startsWith('//')) continue;
      try { node.setAttribute(attr, new URL(value, base).href); } catch { /* leave as-is */ }
    }
  }
  for (const a of root.querySelectorAll('a[href]')) {
    if (!(a.getAttribute('href') || '').startsWith('#')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }
  for (const cb of root.querySelectorAll('input[type="checkbox"]')) cb.disabled = true;
  for (const img of root.querySelectorAll('img')) {
    if (!img.complete) img.addEventListener('load', scheduleMeasure, { once: true });
  }
}

function renderPreview(text) {
  const dirty = markdownToHtml(text);
  const clean = DOMPurify.sanitize(dirty, { ADD_ATTR: ['align', 'target', 'data-line'] });
  ui.preview.innerHTML = clean;
  postProcess(ui.preview);
}

/* ------------------------------------------------------------- mermaid */

function mermaidInit() {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    logLevel: 'error',
    theme: state.theme === 'dark' ? 'dark' : 'default',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    flowchart: { useMaxWidth: true, htmlLabels: true },
    svgMaxSize: 4000
  });
}

async function renderMermaid(root) {
  const blocks = $$('.mermaid-block', root);
  if (!blocks.length) return;
  for (const block of blocks) {
    const srcEl = $('.mermaid-src', block);
    const outEl = $('.mermaid-out', block);
    const code = (srcEl ? srcEl.textContent : '').trim();
    if (!code) { outEl.replaceChildren(); continue; }
    const id = `mmd-${++state.mermaidSeq}`;
    try {
      const { svg, bindFunctions } = await mermaid.render(id, code);
      outEl.innerHTML = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['foreignObject', 'style'],
        ADD_ATTR: ['style', 'class', 'id', 'role', 'aria-hidden', 'aria-label', 'dominant-baseline', 'tabindex']
      });
      const svgEl = $('svg', outEl);
      if (svgEl && typeof bindFunctions === 'function') bindFunctions(svgEl);
      block.classList.remove('is-error');
      const prevErr = $('.mermaid-err', block);
      if (prevErr) prevErr.remove();
    } catch (err) {
      block.classList.add('is-error');
      outEl.replaceChildren();
      const box = document.createElement('div');
      box.className = 'mermaid-err';
      box.textContent = 'Mermaid error: ' + String((err && err.message) || err).split('\n')[0];
      block.prepend(box);
    }
    const stray = document.getElementById('d' + id);
    if (stray) stray.remove();
  }
  scheduleMeasure();
}

/* ------------------------------------------------------------- source pane */

function classifyLines(lines) {
  const out = new Array(lines.length);
  let fenceChar = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const ch = fence[1][0];
      if (!fenceChar) { fenceChar = ch; out[i] = 'sl-fence'; }
      else if (ch === fenceChar) { fenceChar = null; out[i] = 'sl-fence'; }
      else out[i] = 'sl-code';
      continue;
    }
    if (fenceChar) { out[i] = 'sl-code'; continue; }
    if (/^\s{0,3}#{1,6}(\s|$)/.test(line)) out[i] = 'sl-h';
    else if (/^\s{0,3}>/.test(line)) out[i] = 'sl-quote';
    else if (/^\s{0,3}([-*_])[ \t]*(\1[ \t]*){2,}$/.test(line)) out[i] = 'sl-rule';
    else out[i] = '';
  }
  return out;
}

function renderSource(text) {
  const lines = text.split('\n');
  const classes = classifyLines(lines);
  const frag = document.createDocumentFragment();
  for (let i = 0; i < lines.length; i++) {
    const row = document.createElement('div');
    row.className = 'src-line' + (classes[i] ? ' ' + classes[i] : '');
    row.dataset.line = String(i);
    const num = document.createElement('span');
    num.className = 'ln';
    num.textContent = String(i + 1);
    const body = document.createElement('span');
    body.className = 'lt';
    body.textContent = lines[i] === '' ? '\u200b' : lines[i];
    row.append(num, body);
    frag.append(row);
  }
  ui.source.replaceChildren(frag);
}

/* ------------------------------------------------------------ measurement */

function offsetWithin(node, scroller) {
  return node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
}

function measureSource() {
  const visible = ui.sourcePane.offsetParent !== null;
  if (!visible) { sync.srcTops = []; return; }
  const rows = $$('.src-line', ui.source);
  const tops = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) tops[i] = offsetWithin(rows[i], ui.sourceScroll);
  sync.srcTops = tops;
  sync.lineCount = rows.length;
}

function measurePreview() {
  const visible = ui.previewPane.offsetParent !== null;
  if (!visible) { sync.anchors = []; return; }
  const nodes = $$('[data-line]', ui.preview);
  const pts = [{ line: 0, y: 0 }];
  let prevY = 0;
  for (const node of nodes) {
    const line = parseInt(node.dataset.line, 10);
    if (!Number.isFinite(line)) continue;
    const y = offsetWithin(node, ui.previewScroll);
    if (y < prevY) continue;
    const last = pts[pts.length - 1];
    if (last.line === line) { last.y = y; prevY = y; continue; }
    pts.push({ line, y });
    prevY = y;
  }
  const bottom = ui.previewScroll.scrollHeight;
  const lastLine = Math.max(sync.lineCount - 1, pts[pts.length - 1].line);
  if (bottom > prevY) pts.push({ line: lastLine, y: bottom });
  sync.anchors = pts;
}

function measure() {
  measureSource();
  measurePreview();
  updatePosition();
}

function scheduleMeasure() {
  if (sync.measureFrame) cancelAnimationFrame(sync.measureFrame);
  sync.measureFrame = requestAnimationFrame(() => { sync.measureFrame = 0; measure(); });
}

/* ------------------------------------------------------- scroll mapping */

function lineToSourceY(line) {
  const t = sync.srcTops;
  if (!t.length) return 0;
  if (line <= 0) return t[0];
  const i = Math.min(Math.floor(line), t.length - 1);
  if (i >= t.length - 1) return t[t.length - 1];
  return t[i] + (line - i) * (t[i + 1] - t[i]);
}

function sourceYToLine(y) {
  const t = sync.srcTops;
  if (!t.length) return 0;
  if (y <= t[0]) return 0;
  let lo = 0, hi = t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= y) lo = mid; else hi = mid - 1;
  }
  if (lo >= t.length - 1) return t.length - 1;
  const span = t[lo + 1] - t[lo];
  return span > 0 ? lo + (y - t[lo]) / span : lo;
}

function lineToPreviewY(line) {
  const a = sync.anchors;
  if (a.length < 2) return 0;
  if (line <= a[0].line) return a[0].y;
  for (let i = 1; i < a.length; i++) {
    if (line <= a[i].line) {
      const p = a[i - 1], c = a[i];
      const span = c.line - p.line;
      const t = span > 0 ? (line - p.line) / span : 0;
      return p.y + t * (c.y - p.y);
    }
  }
  return a[a.length - 1].y;
}

function previewYToLine(y) {
  const a = sync.anchors;
  if (a.length < 2) return 0;
  if (y <= a[0].y) return a[0].line;
  for (let i = 1; i < a.length; i++) {
    if (y <= a[i].y) {
      const p = a[i - 1], c = a[i];
      const span = c.y - p.y;
      const t = span > 0 ? (y - p.y) / span : 0;
      return p.line + t * (c.line - p.line);
    }
  }
  return a[a.length - 1].line;
}

function releaseDriver() {
  clearTimeout(sync.releaseTimer);
  sync.releaseTimer = setTimeout(() => { sync.driver = null; }, 120);
}

function onSourceScroll() {
  if (state.sync && sync.driver !== 'preview' && sync.srcTops.length) {
    sync.driver = 'source';
    ui.previewScroll.scrollTop = lineToPreviewY(sourceYToLine(ui.sourceScroll.scrollTop));
    releaseDriver();
  }
  updatePosition();
}

function onPreviewScroll() {
  if (state.sync && sync.driver !== 'source' && sync.anchors.length) {
    sync.driver = 'preview';
    ui.sourceScroll.scrollTop = lineToSourceY(previewYToLine(ui.previewScroll.scrollTop));
    releaseDriver();
  }
  updateScrollSpy();
  updatePosition();
}

function scrollToLine(line) {
  ui.sourceScroll.scrollTop = lineToSourceY(Math.max(0, line));
}

function scrollToHeading(id) {
  const head = document.getElementById(id);
  if (!head) return;
  ui.previewScroll.scrollTo({ top: offsetWithin(head, ui.previewScroll) - 8, behavior: 'smooth' });
  const line = head.dataset.line;
  if (line != null) scrollToLine(parseInt(line, 10));
}

/* ------------------------------------------------------------- scroll spy */

function updateScrollSpy() {
  if (!state.tocItems.length) return;
  const top = ui.previewScroll.scrollTop + 16;
  let current = state.tocItems[0];
  for (const item of state.tocItems) {
    if (offsetWithin(item.head, ui.previewScroll) <= top) current = item;
    else break;
  }
  if (state.activeToc === current) return;
  if (state.activeToc) state.activeToc.a.classList.remove('is-active');
  state.activeToc = current;
  if (current) {
    current.a.classList.add('is-active');
    const box = ui.tocList.getBoundingClientRect();
    const item = current.a.getBoundingClientRect();
    if (item.top < box.top || item.bottom > box.bottom) {
      current.a.scrollIntoView({ block: 'nearest' });
    }
  }
}

function updatePosition() {
  if (!state.text) return;
  const line = state.layout === 'source'
    ? sourceYToLine(ui.sourceScroll.scrollTop)
    : previewYToLine(ui.previewScroll.scrollTop);
  const ln = Math.min(Math.round(line) + 1, sync.lineCount || 1);
  const max = state.layout === 'source'
    ? ui.sourceScroll.scrollHeight - ui.sourceScroll.clientHeight
    : ui.previewScroll.scrollHeight - ui.previewScroll.clientHeight;
  const cur = state.layout === 'source' ? ui.sourceScroll.scrollTop : ui.previewScroll.scrollTop;
  const pct = max > 0 ? Math.round((cur / max) * 100) : 0;
  ui.stPos.textContent = `Ln ${ln} / ${sync.lineCount || 1}  ·  ${pct}%`;
}

/* ------------------------------------------------------------------- TOC */

function buildToc() {
  const heads = $$('h1, h2, h3, h4, h5, h6', ui.preview);
  state.tocItems = [];
  state.activeToc = null;
  if (!heads.length) {
    ui.tocList.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'toc-empty';
    empty.textContent = 'No headings in this document';
    ui.tocList.append(empty);
    return;
  }
  const minDepth = Math.min(...heads.map((h) => Number(h.tagName[1])));
  const ul = document.createElement('ul');
  for (const head of heads) {
    const depth = Number(head.tagName[1]);
    const li = document.createElement('li');
    li.className = `toc-d${Math.min(depth - minDepth + 1, 6)}`;
    const a = document.createElement('a');
    const clone = head.cloneNode(true);
    const anchor = $('.anchor', clone);
    if (anchor) anchor.remove();
    const label = (clone.textContent || '').trim();
    a.textContent = label || '(untitled)';
    a.title = a.textContent;
    a.href = head.id ? `#${head.id}` : '#';
    li.append(a);
    ul.append(li);
    state.tocItems.push({ a, head });
  }
  ui.tocList.replaceChildren(ul);
  updateScrollSpy();
}

/* ------------------------------------------------------------- loading */

async function extractFromTab(tabId) {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func: readPageSource });
  return results && results[0] ? results[0].result : null;
}

function describeReadError(url) {
  if (url && url.startsWith('file:')) {
    return 'Local file tabs need "Allow access to file URLs" enabled for this extension at chrome://extensions.';
  }
  return 'Chrome blocks extension scripts on chrome:// pages, the Web Store and similar internal pages, '
    + 'and on tabs that are still loading or already closed.';
}

async function loadTarget(target) {
  hideBanner();
  if (target.ts) state.lastTs = target.ts;

  if (target.tabId == null) {
    showEmptyState();
    return;
  }

  state.tabId = target.tabId;
  ui.empty.hidden = true;
  setStatus('Reading tab…');
  try {
    const info = await extractFromTab(target.tabId);
    if (!info) throw new Error('empty-result');
    state.docUrl = info.url || target.url || '';
    state.docName = nameFor(state.docUrl) || info.title || 'untitled.md';
    ui.stName.textContent = state.docName;
    ui.docLabel.textContent = state.docUrl;
    ui.docLabel.title = state.docUrl;

    if (!info.looksPlain) {
      clearPanes();
      setStatus('Not a raw Markdown document', true);
      showBanner('This tab is an HTML page, not raw Markdown.',
        'Open the .md file (or its raw URL) in a browser tab, then press Reload to preview it.');
      return;
    }
    await applyDocument(info.text || '', state.docName, state.docUrl);
  } catch (err) {
    clearPanes();
    setStatus('Could not read tab', true);
    showBanner('Could not read this tab.', describeReadError(state.docUrl));
  }
}

function clearPanes() {
  ui.preview.replaceChildren();
  ui.source.replaceChildren();
  ui.tocList.replaceChildren();
  state.tocItems = [];
  state.activeToc = null;
  sync.srcTops = [];
  sync.anchors = [];
}

function showEmptyState() {
  state.tabId = null;
  clearPanes();
  ui.empty.hidden = false;
  ui.docLabel.textContent = '';
  ui.stName.textContent = 'No document';
  ui.stStats.textContent = '';
  ui.stPos.textContent = '';
}

async function applyDocument(text, name, url) {
  state.text = text;
  state.docName = name;
  state.docUrl = url;
  ui.empty.hidden = true;
  ui.docLabel.textContent = url || '';
  ui.docLabel.title = url || '';
  document.title = `${name} — Markdown Preview`;

  setStatus('Rendering…');
  renderSource(text);
  renderPreview(text);
  buildToc();
  ui.sourceScroll.scrollTop = 0;
  ui.previewScroll.scrollTop = 0;
  measure();
  updateStats();
  setStatus('');
  toast(`Loaded ${name}`);

  await renderMermaid(ui.preview);
  measure();
}

function updateStats() {
  const lines = sync.lineCount || state.text.split('\n').length;
  const words = (state.text.match(/\S+/g) || []).length;
  ui.stName.textContent = state.docName || 'No document';
  ui.stStats.textContent = `${lines} lines · ${words} words · ${(state.text.length / 1024).toFixed(1)} KB`;
}

/* -------------------------------------------------------------- commands */

function setLayout(layout, persist) {
  state.layout = layout;
  ui.app.dataset.layout = layout;
  $$('.seg-btn', ui.layoutSeg).forEach((b) => b.classList.toggle('is-on', b.dataset.layout === layout));
  if (persist !== false) prefs.save({ layout });
  scheduleMeasure();
}

function setToc(on, persist) {
  state.toc = on;
  ui.app.dataset.toc = on ? 'on' : 'off';
  ui.btnToc.classList.toggle('is-on', on);
  ui.btnToc.setAttribute('aria-pressed', String(on));
  if (persist !== false) prefs.save({ toc: on });
  scheduleMeasure();
}

function setSyncScroll(on, persist) {
  state.sync = on;
  ui.btnSync.classList.toggle('is-on', on);
  ui.btnSync.setAttribute('aria-pressed', String(on));
  if (persist !== false) prefs.save({ syncScroll: on });
}

function applySplit() {
  ui.app.style.setProperty('--split', `${state.split}%`);
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  ui.css.mdLight.disabled = dark;
  ui.css.mdDark.disabled = !dark;
  ui.css.hlLight.disabled = dark;
  ui.css.hlDark.disabled = !dark;
  const use = $('use', ui.btnTheme);
  if (use) use.setAttribute('href', dark ? '#i-sun' : '#i-moon');
  prefs.save({ theme });
}

async function toggleTheme() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  mermaidInit();
  if ($$('.mermaid-block', ui.preview).length) {
    setStatus('Re-rendering diagrams…');
    await renderMermaid(ui.preview);
    measure();
    setStatus('');
  }
}

function updateFullscreenButton() {
  const on = !!document.fullscreenElement;
  ui.btnFullscreen.classList.toggle('is-on', on);
  const use = $('use', ui.btnFullscreen);
  if (use) use.setAttribute('href', on ? '#i-compress' : '#i-expand');
  ui.btnFullscreen.title = on ? 'Exit fullscreen (F)' : 'Fullscreen preview (F)';
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      state.layoutBeforeFullscreen = state.layout;
      await document.documentElement.requestFullscreen();
      setLayout('preview', false);
    }
  } catch {
    toast('Fullscreen is not available here');
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

function reload() {
  if (state.tabId != null) loadTarget({ tabId: state.tabId });
  else toast('No document loaded');
}

/* -------------------------------------------------------------- wiring */

function bindToolbar() {
  ui.layoutSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (btn) setLayout(btn.dataset.layout);
  });

  ui.btnToc.addEventListener('click', () => setToc(!state.toc));
  ui.btnTocClose.addEventListener('click', () => setToc(false));
  ui.btnSync.addEventListener('click', () => setSyncScroll(!state.sync));
  ui.btnTheme.addEventListener('click', toggleTheme);
  ui.btnFullscreen.addEventListener('click', toggleFullscreen);
  ui.btnReload.addEventListener('click', reload);

  document.addEventListener('fullscreenchange', () => {
    updateFullscreenButton();
    if (!document.fullscreenElement && state.layoutBeforeFullscreen) {
      setLayout(state.layoutBeforeFullscreen, false);
      state.layoutBeforeFullscreen = null;
    }
    scheduleMeasure();
  });
}

function bindPreviewEvents() {
  ui.preview.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      e.preventDefault();
      const block = copyBtn.closest('.code-block');
      const code = block && $('code', block);
      const ok = code ? await copyText(code.textContent) : false;
      copyBtn.classList.toggle('is-done', ok);
      copyBtn.textContent = ok ? 'Copied' : 'Failed';
      setTimeout(() => { copyBtn.classList.remove('is-done'); copyBtn.textContent = 'Copy'; }, 1500);
      return;
    }
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    e.preventDefault();
    if (href.startsWith('#')) { scrollToHeading(href.slice(1)); return; }
    if (hasChrome && chrome.tabs) {
      try { await chrome.tabs.create({ url: href, active: false }); return; } catch { /* fall back */ }
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  });

  ui.tocList.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    e.preventDefault();
    const id = decodeURIComponent((link.getAttribute('href') || '#').slice(1));
    if (id) scrollToHeading(id);
  });
}

function bindScroll() {
  ui.sourceScroll.addEventListener('scroll', onSourceScroll, { passive: true });
  ui.previewScroll.addEventListener('scroll', onPreviewScroll, { passive: true });
  window.addEventListener('resize', scheduleMeasure);
}

function bindSplitter() {
  ui.splitter.addEventListener('pointerdown', (e) => {
    if (state.layout !== 'split') return;
    e.preventDefault();
    ui.splitter.setPointerCapture(e.pointerId);
    ui.splitter.classList.add('is-drag');
    document.body.classList.add('is-resizing');
    const rect = ui.panes.getBoundingClientRect();

    const move = (ev) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      state.split = Math.min(80, Math.max(20, pct));
      applySplit();
      scheduleMeasure();
    };
    const up = () => {
      ui.splitter.classList.remove('is-drag');
      document.body.classList.remove('is-resizing');
      ui.splitter.removeEventListener('pointermove', move);
      ui.splitter.removeEventListener('pointerup', up);
      ui.splitter.removeEventListener('pointercancel', up);
      prefs.save({ split: state.split });
      measure();
    };
    ui.splitter.addEventListener('pointermove', move);
    ui.splitter.addEventListener('pointerup', up);
    ui.splitter.addEventListener('pointercancel', up);
  });

  ui.splitter.addEventListener('dblclick', () => {
    state.split = 50;
    applySplit();
    prefs.save({ split: 50 });
    scheduleMeasure();
  });
}

function bindTabEvents() {
  if (!hasChrome || !chrome.tabs) return;
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId !== state.tabId || changeInfo.status !== 'complete') return;
    loadTarget({ tabId });
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId !== state.tabId) return;
    showEmptyState();
    setStatus('Previewed tab was closed');
  });
}

function bindKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const key = e.key.toLowerCase();
    if (key === 'f') toggleFullscreen();
    else if (key === 't') setToc(!state.toc);
    else if (key === 's') setSyncScroll(!state.sync);
    else if (key === 'd') toggleTheme();
    else if (key === '1') setLayout('source');
    else if (key === '2') setLayout('split');
    else if (key === '3') setLayout('preview');
    else return;
    e.preventDefault();
  });
}

/* ------------------------------------------------------- target handling */

const MD_URL = /\.(md|markdown|mdown|mkd|mkdn|mdwn|mdtxt|mdtext|text)(\?|#|$)/i;

async function initialTarget() {
  const params = new URLSearchParams(location.search);
  const tabParam = params.get('tab');
  if (tabParam && /^\d+$/.test(tabParam)) return { tabId: Number(tabParam), ts: Date.now() };

  if (hasChrome) {
    const saved = await chrome.storage.session.get('pendingTarget');
    if (saved.pendingTarget && saved.pendingTarget.tabId != null) return saved.pendingTarget;
  }

  // No explicit request: fall back to the active tab, but only when it is
  // obviously a markdown document, so unrelated HTML tabs keep the welcome
  // screen instead of an error banner.
  if (hasChrome && chrome.tabs) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id != null && tab.url && MD_URL.test(tab.url)) {
        return { tabId: tab.id, ts: Date.now() };
      }
    } catch { /* no tab context */ }
  }
  return null;
}

function watchSessionTarget() {
  if (!hasChrome) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session' || !changes.pendingTarget) return;
    const target = changes.pendingTarget.newValue;
    if (!target || target.tabId == null || target.ts === state.lastTs) return;
    loadTarget(target);
  });
}

/* ------------------------------------------------------------------ boot */

async function boot() {
  await prefs.load();

  // The side panel is often too narrow for two columns; start preview-only
  // there unless the user has already picked a layout.
  if (window.innerWidth < 620 && !state.layoutSaved) state.layout = 'preview';
  // In a narrow pane the TOC floats over the content, so keep it closed
  // until the user asks for it.
  if (window.innerWidth < 620 && !state.tocSaved) state.toc = false;

  setTheme(state.theme);
  applySplit();
  setToc(state.toc, false);
  setSyncScroll(state.sync, false);
  setLayout(state.layout, false);
  updateFullscreenButton();
  mermaidInit();

  bindToolbar();
  bindPreviewEvents();
  bindScroll();
  bindSplitter();
  bindTabEvents();
  bindKeys();
  watchSessionTarget();

  const target = await initialTarget();
  if (target) await loadTarget(target);
  else {
    showEmptyState();
    setStatus('Ready');
  }
}

boot();
