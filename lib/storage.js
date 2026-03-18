/**
 * storage.js — thin async wrapper over chrome.storage.local
 */

const DEFAULT_PROFILE_ID = 'default';

const DEFAULTS = {
  activeProfileId: DEFAULT_PROFILE_ID,
  profiles: {
    [DEFAULT_PROFILE_ID]: {
      id: DEFAULT_PROFILE_ID,
      name: 'Default',
      sites: [],
      schedule: {
        enabled: false,
        rules: [{ days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' }],
      },
    },
  },
  config: {
    unlockChallengeText:
      'I solemnly declare that I am wasting my precious time on distractions instead of focusing on what truly matters. I understand that every minute spent here is a minute I will never get back. I choose discipline over comfort, and I am closing this site now.',
    unlockDurationMinutes: 60,
  },
  unlockedUntil: {}, // { [storedDomain]: expiryTimestampMs }
};

/** @returns {Promise<object>} */
export async function get(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(result);
    });
  });
}

/** @returns {Promise<void>} */
export async function set(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

/** Seeds initial state on first install. Idempotent. Each key is written only if missing. */
export async function initDefaults() {
  const existing = await get(null);
  const writes = [];
  if (!existing.activeProfileId) writes.push(set({ activeProfileId: DEFAULTS.activeProfileId }));
  if (!existing.profiles)        writes.push(set({ profiles: DEFAULTS.profiles }));
  if (!existing.config)          writes.push(set({ config: DEFAULTS.config }));
  if (!existing.unlockedUntil)   writes.push(set({ unlockedUntil: DEFAULTS.unlockedUntil }));
  if (writes.length > 0) await Promise.all(writes);
}

/** Convenience: read the whole store. */
export async function getAll() {
  return get(null);
}
