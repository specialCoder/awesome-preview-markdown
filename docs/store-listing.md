# Chrome Web Store — Listing & Review Materials

Everything to paste into the Chrome Web Developer Dashboard when publishing
**Awesome Preview Markdown**. Text is final; character counts were verified against
the store's limits.

| Field | Limit | This listing |
|-------|:-----:|:-----------:|
| Single purpose statement | 150 | 127 |
| Manifest `description` (short) | 132 | 126 |
| Release notes | 1,000 | 999 |
| Each permission justification | 1,000 | see below |

---

## 1. Identity

- **Name:** Awesome Preview Markdown
- **Version:** 1.0.0 (kept in sync with `manifest.json` and `CHANGELOG.md`)
- **Website:** https://specialcoder.github.io/awesome-preview-markdown/
- **Source:** https://github.com/specialCoder/awesome-preview-markdown
- **License:** Apache-2.0

---

## 2. Single purpose statement (≤150)

```
To preview Markdown files opened in Chrome as a readable dual-pane preview with TOC, Mermaid diagrams, and syntax highlighting.
```

---

## 3. Short description (manifest `description`, ≤132)

```
Preview Markdown in a dual-pane side panel with TOC, Mermaid diagrams, syntax highlighting, copy buttons and synced scrolling.
```

---

## 4. Release notes (≤1,000)

```
Awesome Preview Markdown turns any Markdown file you open in Chrome into a clean, readable preview in a docked side panel. No editor switching, no uploading private files: it only reads the text already in your current tab.

Why install it:
- Read Markdown anywhere. Preview local .md files, raw URLs, or GitHub pages from the right-click menu or toolbar icon. GitHub blob links normalize to raw text automatically.
- A comfortable dual-pane view: source and preview side by side, with line-accurate synced scrolling so the preview follows what you read.
- Rich content out of the box: Mermaid diagrams, syntax highlighting for ~40 languages with one-click Copy, and GitHub-styled tables, task lists, and blockquotes.
- Faster navigation: auto-built table of contents with scroll-spy and click-to-jump, plus fullscreen and light/dark themes.
- Privacy by design: a Manifest V3 extension that never fetches documents itself, adds no trackers, and renders locally. Your Markdown stays on your machine.
```

---

## 5. Privacy policy URL

```
https://specialcoder.github.io/awesome-preview-markdown/privacy.html
```

Source file: `docs/privacy.html`. Requires GitHub Pages enabled (branch `main`,
folder `/docs`) and the file pushed before the URL resolves.

### Data privacy declarations (Dashboard → Privacy tab)

- **Single purpose:** Markdown preview (see §2).
- **Limited Use:** Not applicable — no user data is collected.
- **Data collected:** None. The extension does not collect, transmit, or store
  personally identifiable information, content, browsing history, or analytics.
- **Data usage / sharing:** None; no third parties, no ad networks, no trackers.
- **Affiliation:** Independent; not affiliated with Google or the Chrome Web Store.

---

## 6. Permission justifications (each ≤1,000)

### `contextMenus`
```
We use the contextMenus permission to add a single right-click item, "Preview markdown on side", on pages, links, and frames. This is the core way users launch a preview: they right-click the Markdown they are viewing and it opens in the side panel. No other menu items are added and nothing runs without the user explicitly choosing this command.
```

### `sidePanel`
```
We use the sidePanel permission to dock the Markdown reader in Chrome's built-in side panel so the preview sits beside the page the user is already reading, rather than stealing focus in a new window. This is essential to the extension's single purpose of providing a side-by-side Markdown preview. If the side panel cannot be opened, the reader falls back to a normal tab.
```

### `storage`
```
We use chrome.storage for two things only. (1) storage.session: to pass a short-lived reference to the target tab between the background service worker and the side-panel viewer while a preview is open. (2) storage.local: to remember the user's own interface preferences — theme (light/dark), layout mode, table-of-contents and synced-scrolling toggles, and the splitter position — so they persist across sessions. No personal data, browsing history, or document content is stored; everything stays on the user's device and can be cleared with the extension.
```

### `scripting`
```
We use scripting to run one small, read-only function (readPageSource) inside the tab the user has already opened, so we can read the plain text that is already displayed there and render it as Markdown in the side panel. The injected code only reads the tab's existing text content; it does not modify the page, capture input, or fetch any additional resources. It runs solely in response to the user's explicit preview command.
```

### `clipboardWrite`
```
We use clipboardWrite for the "Copy" button on each rendered code block, letting the user copy that code's text to the clipboard with one click. Writing to the clipboard happens only when the user clicks the button; nothing is copied automatically or without user action.
```

### Host permissions (`<all_urls>`)
```
The extension never fetches documents on its own and makes no network requests. It only reads the text of a tab that the user has already opened in their browser. Because users preview Markdown from many different sources — local files (file://), raw URLs, and GitHub pages — the host permission is broad so the read-only text extraction can run on whichever page the user chooses to preview. It is used strictly to read already-loaded content from the active tab for rendering, not to access, request, or transmit data from any site.
```

---

## 7. Store metadata suggestions

- **Category:** Productivity
- **Languages:** English, 简体中文 (add more as translations are provided)
- **Package:** build with `scripts/package.sh` →
  `dist/awesome-preview-markdown-v<version>.zip` (manifest at zip root)

---

## 8. Assets checklist (upload separately in the Dashboard)

- [ ] Small promo tile (440×280)
- [ ] Screenshots (≥1, min 1280×800 or 640×400) — reuse `docs/assets/*.png`
- [ ] Icon (128×128) — `icons/icon128.png`
- [ ] Privacy policy URL (§5) is live and reachable
