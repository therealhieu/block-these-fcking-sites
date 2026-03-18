/**
 * service-worker.js — Background service worker.
 * Orchestrates all engines and handles messages from UI pages.
 */

import { initDefaults, getAll } from '../lib/storage.js';
import { registerBlockEngine, sweepOpenTabs } from '../lib/block-engine.js';
import {
  createProfile,
  deleteProfile,
  renameProfile,
  switchProfile,
  addSite,
  removeSite,
  updateSchedule,
} from '../lib/profile-manager.js';
import { normalizeDomain, isValidDomain } from '../lib/domain-normalizer.js';
import { attemptUnlockSite } from '../lib/removal-manager.js';
import { isScheduleActive } from '../lib/schedule-engine.js';

// ── Lifecycle ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await initDefaults();
  sweepOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  sweepOpenTabs();
});

// ── Block engine ───────────────────────────────────────────────────────────

registerBlockEngine();

// ── Message routing ────────────────────────────────────────────────────────
// UI pages communicate via chrome.runtime.sendMessage / onMessage.
// Each message has a { type, ...payload } shape.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  let responded = false;
  function safeRespond(value) {
    if (responded) return;
    responded = true;
    try { sendResponse(value); } catch { /* channel already closed */ }
  }

  handleMessage(msg)
    .then(safeRespond)
    .catch((err) => safeRespond({ error: err.message ?? String(err) }));

  return true; // keep channel open for async response
});

async function handleMessage(msg) {
  switch (msg.type) {
    case 'GET_STATE':
      return getAll();

    case 'CREATE_PROFILE': {
      const profile = await createProfile(msg.name);
      sweepOpenTabs();
      return { profile };
    }

    case 'DELETE_PROFILE':
      await deleteProfile(msg.id);
      sweepOpenTabs();
      return {};

    case 'RENAME_PROFILE':
      await renameProfile(msg.id, msg.name);
      return {};

    case 'SWITCH_PROFILE':
      await switchProfile(msg.id);
      sweepOpenTabs();
      return {};

    case 'ADD_SITE': {
      const domain = normalizeDomain(msg.domain);
      if (!isValidDomain(domain)) throw new Error(`Invalid domain: "${msg.domain}"`);
      await addSite(msg.profileId, domain);
      sweepOpenTabs();
      return { domain };
    }

    case 'REMOVE_SITE': {
      // Permanent removal — settings page only. Schedule gate enforced here server-side
      // (the UI also disables the button, but defence-in-depth is required).
      const stateForRemove = await getAll();
      const profileForRemove = stateForRemove.profiles?.[msg.profileId];
      if (profileForRemove && isScheduleActive(profileForRemove.schedule)) {
        throw new Error('Cannot remove a site during an active blocking window.');
      }
      await removeSite(msg.profileId, msg.domain);
      sweepOpenTabs();
      return { success: true };
    }

    case 'UNLOCK_SITE': {
      // Temporary timed unlock — triggered by the block page typing challenge.
      // Site stays in the blocklist; access expires after config.unlockDurationMinutes.
      const result = await attemptUnlockSite(msg.profileId, msg.domain, msg.typedChallenge);
      // No sweepOpenTabs here — the now-unblocked tab navigates itself
      return result;
    }

    case 'UPDATE_SCHEDULE':
      await updateSchedule(msg.profileId, msg.schedule);
      sweepOpenTabs();
      return {};

    default:
      throw new Error(`Unknown message type: ${msg.type}`);
  }
}
