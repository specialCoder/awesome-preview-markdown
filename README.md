# Awesome Preview Markdown

**English** | [简体中文](README.zh-CN.md)

A Chrome extension (Manifest V3) that previews local and remote Markdown files in a
**side-by-side dual pane** — source on the left, rendered preview on the right — with a
table of contents, Mermaid diagrams, syntax highlighting, one-click copy, and synchronized
scrolling.

The guiding design rule: **the extension never opens files or fetches URLs itself.** Your
browser opens the document in a tab (via `file://`, an HTTP(S) URL, or a link you click);
the extension only reads that tab's plain-text content back and renders it. No file picker,
no URL bar, no drag-and-drop, no background network requests.

![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![Manifest](https://img.shields.io/badge/manifest-V3-green)

---

## Features

- **Right-click to preview** — "Preview markdown on side" opens the document in Chrome's
  side panel; the toolbar icon does the same for the active tab.
- **Dual-pane layout** — source and preview side by side, with a single toolbar spanning
  both. Switch between *source only*, *split*, and *preview only*; drag the splitter to
  resize, or double-click it to reset to 50%.
- **Table of contents** — generated from headings, docked on the **right** of the preview
  (occupies real layout space, never floats over content), with scroll-spy highlighting and
  click-to-jump. Toggleable.
- **Mermaid diagrams** — flowcharts, sequence, class, state, ER, Gantt, pie, journey,
  gitGraph, mindmap, and timeline. Invalid diagrams degrade gracefully with an inline error
  instead of breaking the page.
- **Syntax highlighting + copy** — ~70 languages via highlight.js, each code block with a
  language label and a one-click **Copy** button.
- **Synchronized scrolling** — line-accurate two-way sync between source and preview using
  piecewise-linear interpolation over block anchors. Toggleable.
- **Fullscreen & theme** — toggle fullscreen preview and switch light/dark.
- **Status bar** — live document stats (`lines · words · KB`), the file name, and your
  reading position.
- **Numbered source pane** — sticky line numbers with per-line syntax tinting.
- **Remembers your settings** — theme, layout, TOC, sync, and splitter position persist
  across sessions (`chrome.storage.local`).
- **Auto-follows the tab** — when the source tab navigates or reloads, the preview refreshes
  automatically; closing the tab returns to the welcome screen.
- **System dark mode** — on first run the theme follows your OS light/dark preference.
- **Built from ready-made libraries** — no build step, no bundler; vendored `min.js`/`min.css`.

---

## Screenshots

| | |
|---|---|
| Right-click → **Preview markdown on side** (dual pane) | ![usage](docs/assets/usage.png) |
| Layout modes + draggable splitter | ![layout](docs/assets/layout.png) |
| Syntax highlighting across languages + one-click copy | ![code](docs/assets/multiple-code-language.png) |
| Mermaid diagrams | ![mermaid](docs/assets/mermaid.png) |
| Fullscreen preview with table of contents | ![fullscreen](docs/assets/fullscreen.png) |

---

## Install (load unpacked)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select **this repository's root folder** (the one containing
   `manifest.json`).
5. Pin the extension icon to the toolbar for quick access.

> **Viewing local `file://` Markdown:** on the extension's card in `chrome://extensions`,
> click **Details** and enable **Allow access to file URLs**. Remote `http(s)://` files need
> no extra setting.

---

## Usage

**Open a Markdown document in a browser tab first**, then preview it:

- Right-click anywhere on the page → **Preview markdown on side**, or
- Click the **toolbar icon** while a Markdown tab is active.

If you right-click a *link* to a Markdown file, the extension opens that link in a new
background tab (rewriting GitHub `blob` links to `raw.githubusercontent.com`) and previews it.

The preview opens in Chrome's **side panel**. If the side panel can't open, it falls back to
opening the preview in a new tab of the current window.

### Keyboard shortcuts (focus on the preview panel)

| Key | Action |
|-----|--------|
| `1` | Source-only layout |
| `2` | Split layout |
| `3` | Preview-only layout |
| `T` | Toggle table of contents |
| `S` | Toggle synchronized scrolling |
| `F` | Toggle fullscreen |
| `D` | Toggle light/dark theme |

Toolbar buttons cover the same actions plus **reload**.

---

## How it works

- `background.js` — service worker: builds the context menu, opens/normalizes tabs, and
  opens the side panel (falling back to a new tab in the current window).
- `viewer.js` — injects a small reader into the target tab via `chrome.scripting`, pulls the
  plain-text Markdown back, then renders with **marked** → sanitized with **DOMPurify** →
  highlighted with **highlight.js** → diagrams with **mermaid**. Sync scrolling is driven by
  per-block `data-line` anchors computed from the marked token stream.
- The extension reads only what the browser already displayed. HTML (non-Markdown) tabs show
  a guidance banner instead of an error.

---

## Permissions

| Permission | Why |
|------------|-----|
| `contextMenus` | The "Preview markdown on side" menu item. |
| `sidePanel` | Hosts the preview UI. |
| `scripting` | Reads the active tab's plain-text Markdown content. |
| `storage` | Remembers the pending preview target and your layout/theme prefs. |
| `clipboardWrite` | The code-block **Copy** button. |
| `host_permissions: <all_urls>` | Lets you preview Markdown from any site or local file you open. |

The extension makes **no** network requests of its own and sends no data anywhere.

---

## Project structure

```
awesome-preview-markdown/
├─ manifest.json          # MV3 manifest
├─ background.js          # service worker (menus, tabs, panel)
├─ viewer.html/css/js     # the preview UI
├─ icons/                 # 16 / 48 / 128 px icons
├─ vendor/                # bundled min.js / min.css libraries + LICENSES.md
├─ samples/               # local Markdown for manual testing
├─ docs/                  # GitHub Pages landing page + assets
├─ scripts/               # packaging script (build the release zip)
├─ TEST_CASES.md          # manual test checklist (local + online)
├─ CHANGELOG.md
├─ NOTICE.md              # third-party attribution
└─ LICENSE                # Apache-2.0
```

---

## Testing

This project uses a **manual test checklist** (no build/test tooling). See
[`TEST_CASES.md`](TEST_CASES.md) for local-file and online-URL cases, including a stress
document (`samples/stress.md`) that exercises every renderer feature.

Quick local run:

```bash
python3 -m http.server 8765
# open http://localhost:8765/samples/stress.md in a tab, then preview it
```

---

## Release packaging

Build a distributable zip containing **only** what the extension needs (runtime files plus
`LICENSE`/`NOTICE.md` for license compliance). `samples/`, `docs/`, `scripts/`, and the
markdown docs are excluded.

```bash
./scripts/package.sh
# → dist/awesome-preview-markdown-v<version>.zip  (manifest.json at the zip root)
```

The version is read from `manifest.json`. Upload that zip to the Chrome Web Store, or share
it directly for "Load unpacked" after unzipping.

---

## Third-party libraries

marked, DOMPurify, highlight.js, mermaid, and github-markdown-css. Versions and licenses are
listed in [`NOTICE.md`](NOTICE.md) and [`vendor/LICENSES.md`](vendor/LICENSES.md).

---

## License

Apache License 2.0 — see [`LICENSE`](LICENSE).
