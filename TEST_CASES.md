# Test Cases (manual checklist)

This project has no automated test runner. Verify each release by working through the
checklist below in a real Chrome with the extension **loaded unpacked** from the repo root.

Preparation:
1. `chrome://extensions` → Developer mode ON → **Load unpacked** → select the repo root.
2. For `file://` cases: extension **Details** → enable **Allow access to file URLs**.
3. After any code change: click the ⟳ reload on the extension card, then reload the test tab.

Legend: ☐ = not yet checked.

---

## A. Local file cases

Serve the repo so files open over HTTP (avoids `file://` quirks) — or open them directly:

```bash
python3 -m http.server 8765
```

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| A1 | Open `http://localhost:8765/samples/sample.md`, right-click → **Preview markdown on side** | Side panel opens, dual-pane renders | ☐ |
| A2 | Same tab, click the **toolbar icon** | Preview opens for the active tab | ☐ |
| A3 | Open `samples/stress.md` | All sections render; no crash | ☐ |
| A4 | Open a local file via `file:///…/samples/sample.md` (after enabling file access) | Renders correctly | ☐ |
| A5 | Open a non-Markdown HTML page and preview it | Guidance banner ("HTML page, not raw Markdown"), no error spam | ☐ |
| A6 | Open a plain `.txt`/`.text` file | Renders as Markdown | ☐ |

## B. Online cases

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| B1 | Open a raw Markdown URL, e.g. `https://raw.githubusercontent.com/markedjs/marked/master/README.md`, then preview | Renders | ☐ |
| B2 | Right-click a GitHub **blob** link to a `.md` file → preview | Opens `raw.githubusercontent.com` in a new background tab and previews it | ☐ |
| B3 | Open a remote Markdown containing images with relative/absolute URLs | Images load per browser behavior | ☐ |
| B4 | Preview a large remote Markdown (1000+ lines) | Renders without freezing; scrolling stays smooth | ☐ |

## C. Feature checklist (use `samples/stress.md`)

| # | Feature | Expected | ☐ |
|---|---------|----------|---|
| C1 | Layout buttons / keys `1` `2` `3` | Switch source / split / preview | ☐ |
| C2 | Splitter drag + double-click | Resizes panes; double-click resets to 50% | ☐ |
| C3 | TOC toggle (`T`) | TOC shows/hides; **docked right, occupies layout space (no overlay)** | ☐ |
| C4 | TOC click + scroll-spy | Clicking jumps to section; active item tracks scroll | ☐ |
| C5 | Sync scroll (`S`) | Scrolling one pane moves the other proportionally | ☐ |
| C6 | Fullscreen (`F`) | Enters/exits fullscreen preview | ☐ |
| C7 | Theme (`D`) | Light/dark switch, applies to preview + code + TOC | ☐ |
| C8 | Pop-out window | Detaches preview to a resizable window | ☐ |
| C9 | Reload button | Re-reads the tab and re-renders | ☐ |
| C10 | Code blocks | ~40 languages highlighted; language label shown | ☐ |
| C11 | Copy button | Copies exact code text to clipboard | ☐ |
| C12 | No-lang / unknown-lang code fence | Auto-detect or plain render, no crash | ☐ |
| C13 | Mermaid (11 valid diagrams) | All render | ☐ |
| C14 | Broken mermaid (block 12) | Inline error shown, page still works | ☐ |
| C15 | Tables (aligned + 10-col wide) | Render with GitHub styling | ☐ |
| C16 | Nested / task lists | Correct nesting; checkboxes render | ☐ |
| C17 | Nested blockquotes (3 levels) | Correct nesting | ☐ |
| C18 | Links (autolink, titled, reference) | Resolve correctly | ☐ |
| C19 | Raw HTML `<details>/<summary>/<kbd>/<mark>` | Rendered | ☐ |
| C20 | Embedded `<script>` in Markdown | **Stripped by DOMPurify — must NOT execute or appear** | ☐ |
| C21 | Escapes, entities, hard breaks | Render correctly | ☐ |
| C22 | Very long CJK + English single lines | Wrap without breaking layout | ☐ |
| C23 | Duplicate headings | TOC anchors de-duplicated (no broken jumps) | ☐ |

## D. Security / privacy

| # | Check | Expected | ☐ |
|---|-------|----------|---|
| D1 | XSS payload in Markdown (e.g. `<img onerror=…>`, `<script>`) | Sanitized, no execution | ☐ |
| D2 | DevTools → Network while previewing | No requests initiated by the extension itself | ☐ |
| D3 | Mermaid `securityLevel` | Strict; diagram labels can't run scripts | ☐ |

---

Known environment limits (not bugs): in some embedded/automated browsers `requestFullscreen()`
may not settle and clipboard reads may be blocked when the page is unfocused — test C6 and C11
in a normal, focused Chrome window.
