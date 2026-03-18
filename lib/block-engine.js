/**
 * block-engine.js
 *
 * URL matching + enforcement.
 * Imported by the service worker; not a standalone module.
 */

import { getAll } from './storage.js';
import { isScheduleActive } from './schedule-engine.js';

let _blockPage = null;
function getBlockPage() {
  if (!_blockPage) _blockPage = chrome.runtime.getURL('blocked/blocked.html');
  return _blockPage;
}

// Set membership is O(1); avoids allocating an array literal on every navigation event
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);


/**
 * Returns true if `hostname` matches `domain` exactly or as a subdomain.
 * @param {string} hostname  e.g. "www.reddit.com"
 * @param {string} domain    e.g. "reddit.com"
 */
function matchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith('.' + domain);
}

/**
 * Given the current storage state, returns true if the URL should be blocked.
 * @param {string} url
 * @param {object} state  full storage object
 * @returns {boolean}
 */
function shouldBlock(url, state) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Only block http/https navigations
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;

  const { activeProfileId, profiles } = state;
  const profile = profiles?.[activeProfileId];
  if (!profile) return false;

  // Guard: don't block if we're already on the block page
  if (url.startsWith(getBlockPage())) return false;

  const hostname = parsed.hostname;
  const matchedSite = (profile.sites ?? []).find((s) => matchesDomain(hostname, s.domain));
  if (!matchedSite) return false;

  // Temporary unlock gate: skip blocking if site was unlocked and hasn't expired
  const expiry = state.unlockedUntil?.[matchedSite.domain];
  if (expiry && Date.now() < expiry) return false;

  // Schedule gate: if schedule says NOT active right now, allow navigation
  if (!isScheduleActive(profile.schedule)) return false;

  return true;
}

/**
 * Redirect a tab to the block page for the given domain.
 * @param {number} tabId
 * @param {string} domain
 */
function redirectToBlockPage(tabId, domain) {
  const target = `${getBlockPage()}?domain=${encodeURIComponent(domain)}`;
  return chrome.tabs.update(tabId, { url: target });
}

/**
 * Sweep all open tabs and redirect those that should now be blocked.
 * Called when the extension starts or when schedule status changes.
 * Errors per-tab are caught individually so one failure doesn't abort the sweep.
 */
export async function sweepOpenTabs() {
  const state = await getAll();
  const tabs = await chrome.tabs.query({});
  const redirects = tabs
    .filter((tab) => tab.url && shouldBlock(tab.url, state))
    .map((tab) => {
      try {
        const parsed = new URL(tab.url);
        const profile = state.profiles?.[state.activeProfileId];
        const matchedSite = (profile?.sites ?? []).find((s) => matchesDomain(parsed.hostname, s.domain));
        return redirectToBlockPage(tab.id, matchedSite?.domain ?? parsed.hostname);
      } catch {
        return Promise.resolve();
      }
    });
  await Promise.allSettled(redirects);
}

/**
 * Register the webNavigation listener.
 * Must be called once from the service worker.
 *
 * Note: async listeners on webNavigation are safe in MV3 — we don't need to
 * block the navigation synchronously; we redirect *after* it starts, which
 * Chrome permits via chrome.tabs.update during the onBeforeNavigate phase.
 */
export function registerBlockEngine() {
  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only intercept top-level navigations
    if (details.frameId !== 0) return;

    const state = await getAll();
    if (!shouldBlock(details.url, state)) return;

    try {
      const parsed = new URL(details.url);
      const profile = state.profiles?.[state.activeProfileId];
      const matchedSite = (profile?.sites ?? []).find((s) => matchesDomain(parsed.hostname, s.domain));
      await redirectToBlockPage(details.tabId, matchedSite?.domain ?? parsed.hostname);
    } catch {
      // ignore
    }
  });
}
