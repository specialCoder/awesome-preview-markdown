# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The `version` field in `manifest.json` is kept in sync with the latest entry below.

## [Unreleased]

### Added
- Toolbar "More apps…" entry (flame icon) that opens https://i.eatmango.cn/ in a new tab.
- `scripts/package.sh` — builds a distribution zip of only the runtime files
  (`dist/awesome-preview-markdown-v<version>.zip`, manifest at the zip root).

### Changed
- When the side panel can't be opened, the preview now falls back to a **new tab in the
  current window** instead of a separate pop-out window.

### Fixed
- Shortened the `manifest.json` `description` to 126 characters so it stays within the Chrome
  Web Store's 132-character limit.
- Removed the non-standard `"author"` key from `manifest.json` (authorship lives in `LICENSE`,
  `NOTICE.md`, and the READMEs).

### Removed
- The manual "Open in a window docked to the side" toolbar button and the pop-out window path.

## [1.0.0] - 2026-10-03

### Added
- Manifest V3 Chrome extension that previews Markdown in Chrome's side panel, with a
  new-tab fallback.
- Right-click context menu **"Preview markdown on side"** and a toolbar-icon action; links
  to Markdown files open in a new background tab (GitHub `blob` links normalized to
  `raw.githubusercontent.com`).
- Dual-pane layout (source | preview) with a shared toolbar and a draggable splitter;
  source-only / split / preview-only modes.
- Right-docked, in-flow **table of contents** with scroll-spy and click-to-jump; toggleable.
- **Mermaid** rendering (flowchart, sequence, class, state, ER, Gantt, pie, journey,
  gitGraph, mindmap, timeline) with graceful inline errors for invalid diagrams.
- **Syntax highlighting** for ~70 languages via highlight.js, each code block labeled with
  its language and a one-click **Copy** button.
- **Synchronized scrolling** between source and preview using line-accurate piecewise-linear
  interpolation over block anchors; toggleable.
- **Fullscreen** toggle and **light/dark theme** toggle.
- Keyboard shortcuts: `1`/`2`/`3` layout, `T` TOC, `S` sync, `F` fullscreen, `D` theme.
- Browser-opens-content model: the extension only reads the active tab's plain-text content
  via `chrome.scripting`; it never fetches URLs or reads files itself. HTML tabs show a
  guidance banner instead of an error.
- Rendering pipeline: marked → DOMPurify (XSS sanitization) → highlight.js → mermaid.
- Bundled vendor libraries (`vendor/`) — no build step required.
- Sample documents for manual testing: `samples/sample.md` and the feature stress file
  `samples/stress.md`.
- Status bar with live document stats (`lines · words · KB`), file name, and reading position.
- Numbered source pane with sticky line numbers and per-line syntax tinting.
- Persistent preferences (theme, layout, TOC, sync, splitter position) via `chrome.storage.local`.
- Auto-follow the source tab: the preview reloads on tab navigation/update and clears on tab close.
- Initial theme follows the OS `prefers-color-scheme` when no preference is stored.
- Splitter double-click resets the layout to 50%.

### Security
- All rendered HTML (marked output and mermaid SVG) is sanitized with DOMPurify; raw
  `<script>` and other active content in Markdown are stripped.

[Unreleased]: https://github.com/specialCoder/awesome-preview-markdown/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/specialCoder/awesome-preview-markdown/releases/tag/v1.0.0
