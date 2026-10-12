const MENU_ID = 'preview-markdown-on-side';
const PANEL_PATH = 'viewer.html';

// Only auto-preview tabs that clearly hold a Markdown document; anything else
// opens the panel to its welcome screen instead of force-reading and erroring.
const MD_URL = /\.(md|markdown|mdown|mkd|mkdn|mdwn|mdtxt|mdtext|text)(\?|#|$)/i;
const GH_BLOB = /^https?:\/\/(?:www\.)?github\.com\/[^/]+\/[^/]+\/blob\//;

// The extension never fetches documents itself: the browser opens them in a
// tab and the viewer reads that tab's rendered text. GitHub blob pages are
// HTML, so point the new tab at the raw markdown endpoint instead.
function normalizeUrl(url) {
  const m = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:\?|#|$)/.exec(url);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${decodeURIComponent(m[4])}`;
  return url;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Preview markdown on side',
      contexts: ['page', 'link', 'frame']
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  if (info.linkUrl) {
    // Let the browser open the document in its own tab; we then render it.
    const newTab = await chrome.tabs.create({ url: normalizeUrl(info.linkUrl), active: false });
    await openPreview({ tabId: newTab.id, url: newTab.url || info.linkUrl, ts: Date.now() }, tab.windowId);
    return;
  }

  if (!tab) return;
  await openPreview({ tabId: tab.id, url: tab.url || '', ts: Date.now() }, tab.windowId);
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab) return;
  const url = tab.url || '';

  // A GitHub blob page is HTML, so mirror the context-menu link path: open the
  // raw endpoint in a background tab and preview that instead of erroring.
  if (GH_BLOB.test(url) && MD_URL.test(url)) {
    const newTab = await chrome.tabs.create({ url: normalizeUrl(url), active: false });
    await openPreview({ tabId: newTab.id, url: newTab.url || url, ts: Date.now() }, tab.windowId);
    return;
  }

  const target = MD_URL.test(url)
    ? { tabId: tab.id, url, ts: Date.now() }
    : { tabId: null, ts: Date.now() }; // no explicit target → welcome screen
  await openPreview(target, tab.windowId);
});

async function openPreview(target, windowId) {
  await chrome.storage.session.set({ pendingTarget: target });
  try {
    await chrome.sidePanel.setOptions({ path: PANEL_PATH, enabled: true });
    await chrome.sidePanel.open({ windowId });
  } catch (err) {
    // sidePanel.open() can reject when the gesture is not recognised; fall
    // back to opening the viewer in a new tab of the same window so the
    // command never silently fails.
    await openInTab(target, windowId);
  }
}

async function openInTab(target, windowId) {
  const url =
    chrome.runtime.getURL(PANEL_PATH) +
    (target && target.tabId != null ? `?tab=${target.tabId}` : '');
  const opts = { url, active: true };
  if (windowId != null) opts.windowId = windowId;
  return chrome.tabs.create(opts);
}
