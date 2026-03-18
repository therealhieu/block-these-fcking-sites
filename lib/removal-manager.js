/**
 * removal-manager.js
 *
 * Two operations:
 *
 *   attemptUnlockSite  — typing-challenge gate → temporary timed access (block page flow)
 *                        Site STAYS in the blocklist. Access expires after unlockDurationMinutes.
 *                        Schedule gate is intentionally ABSENT — the whole point of unlock
 *                        is urgent access *during* a blocking window.
 *
 *   (permanent removal is handled directly by profile-manager.removeSite,
 *    called from the service worker's REMOVE_SITE handler for the settings page)
 */

import { get, set } from './storage.js';
import { verifyTypingChallenge } from './challenge.js';

export { verifyTypingChallenge } from './challenge.js';

/**
 * Attempt to temporarily unlock a site.
 * Only the typing challenge gate applies (no schedule gate — unlock = urgent access).
 *
 * @param {string} profileId
 * @param {string} domain      stored domain (e.g. "reddit.com"), as passed by block-engine
 * @param {string} typedChallenge
 * @returns {Promise<{ success: boolean, reason?: string, expiresAt?: number }>}
 */
export async function attemptUnlockSite(profileId, domain, typedChallenge) {
  const { profiles, config, unlockedUntil } = await get(null);
  const profile = profiles?.[profileId];
  if (!profile) return { success: false, reason: 'Profile not found.' };

  // Verify domain is actually tracked in this profile
  const exists = (profile.sites ?? []).some((s) => s.domain === domain);
  if (!exists) return { success: false, reason: 'Domain not found in this profile.' };

  // Challenge gate
  const expected = config?.unlockChallengeText ?? '';
  if (!verifyTypingChallenge(expected, typedChallenge)) {
    return { success: false, reason: 'Typing challenge not completed correctly.' };
  }

  const durationMs = (config?.unlockDurationMinutes ?? 60) * 60 * 1000;
  const expiresAt = Date.now() + durationMs;

  // Prune expired entries while we're here
  const now = Date.now();
  const pruned = Object.fromEntries(
    Object.entries(unlockedUntil ?? {}).filter(([, exp]) => exp > now),
  );

  await set({ unlockedUntil: { ...pruned, [domain]: expiresAt } });
  return { success: true, expiresAt };
}
