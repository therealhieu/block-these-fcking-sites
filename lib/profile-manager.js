/**
 * profile-manager.js — CRUD operations on profiles and profile switching.
 */

import { get, set } from './storage.js';

/** Generate a simple unique id. */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Fetch the complete profiles map and active profile id. */
async function load() {
  const { profiles, activeProfileId } = await get(null);
  return { profiles: profiles ?? {}, activeProfileId };
}

/**
 * Create a new profile with default settings.
 * @param {string} name
 * @returns {Promise<object>} the new profile object
 */
export async function createProfile(name) {
  const { profiles, activeProfileId } = await load();
  const id = uid();
  const profile = {
    id,
    name: name.trim(),
    sites: [],
    schedule: {
      enabled: false,
      rules: [{ days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' }],
    },
  };
  profiles[id] = profile;
  await set({ profiles });
  return profile;
}

/**
 * Delete a profile.
 * Throws if it's the last profile or if it still has blocked sites.
 * @param {string} id
 */
export async function deleteProfile(id) {
  const { profiles, activeProfileId } = await load();

  if (Object.keys(profiles).length <= 1) {
    throw new Error('Cannot delete the last remaining profile.');
  }

  const profile = profiles[id];
  if (!profile) throw new Error(`Profile "${id}" not found.`);

  if ((profile.sites ?? []).length > 0) {
    throw new Error('Remove all blocked sites from this profile before deleting it.');
  }

  delete profiles[id];

  // If we deleted the active profile, switch to the first remaining one
  const newActiveId = id === activeProfileId ? Object.keys(profiles)[0] : activeProfileId;

  await set({ profiles, activeProfileId: newActiveId });
}

/**
 * Rename a profile.
 * @param {string} id
 * @param {string} name
 */
export async function renameProfile(id, name) {
  const { profiles, activeProfileId } = await load();
  if (!profiles[id]) throw new Error(`Profile "${id}" not found.`);
  profiles[id].name = name.trim();
  await set({ profiles });
}

/**
 * Switch the active profile.
 * Full atomic read+write to avoid racing with concurrent addSite/updateSchedule writers.
 * @param {string} id
 */
export async function switchProfile(id) {
  const { profiles, activeProfileId: _prev } = await load();
  if (!profiles[id]) throw new Error(`Profile "${id}" not found.`);
  // Write full store snapshot so no partial-key race is possible
  await set({ profiles, activeProfileId: id });
}

/** @returns {Promise<object>} */
export async function getActiveProfile() {
  const { profiles, activeProfileId } = await load();
  return profiles[activeProfileId] ?? Object.values(profiles)[0];
}

/** @returns {Promise<object>} all profiles keyed by id */
export async function getAllProfiles() {
  const { profiles } = await load();
  return profiles;
}

/**
 * Add a site to a profile. Silently ignores duplicates.
 * @param {string} profileId
 * @param {string} domain  already-normalised domain
 */
export async function addSite(profileId, domain) {
  const { profiles, activeProfileId } = await load();
  const profile = profiles[profileId];
  if (!profile) throw new Error(`Profile "${profileId}" not found.`);

  const alreadyExists = profile.sites.some((s) => s.domain === domain);
  if (!alreadyExists) {
    profile.sites.push({ domain });
    await set({ profiles, activeProfileId });
  }
}

/**
 * Remove a site from a profile (no gate check — caller must verify eligibility).
 * @param {string} profileId
 * @param {string} domain
 */
export async function removeSite(profileId, domain) {
  const { profiles, activeProfileId, unlockedUntil } = await get(null);
  const profile = profiles[profileId];
  if (!profile) throw new Error(`Profile "${profileId}" not found.`);

  profile.sites = profile.sites.filter((s) => s.domain !== domain);

  // Prune stale unlock grant for this domain so re-adding it later doesn't
  // inherit the old (possibly still-valid) expiry.
  const { [domain]: _removed, ...remainingUnlocks } = unlockedUntil ?? {};

  await set({ profiles, unlockedUntil: remainingUnlocks });
}

/**
 * Update a profile's schedule.
 * @param {string} profileId
 * @param {{ enabled: boolean, rules: Array }} schedule
 */
export async function updateSchedule(profileId, schedule) {
  const { profiles, activeProfileId } = await load();
  const profile = profiles[profileId];
  if (!profile) throw new Error(`Profile "${profileId}" not found.`);
  profile.schedule = schedule;
  await set({ profiles });
}
