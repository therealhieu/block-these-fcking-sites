/**
 * schedule-engine.js
 *
 * Determines whether blocking is currently active given a profile's schedule.
 *
 * UX convention:
 *   schedule.enabled = false  → block ALL day (no time restrictions, most restrictive)
 *   schedule.enabled = true   → block only during matching rules windows
 */

/**
 * Convert "HH:MM" to minutes-since-midnight for arithmetic comparison.
 * @param {string} t "HH:MM"
 * @returns {number}
 */
function toMinutes(t) {
  if (!t || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Returns true if blocking is active RIGHT NOW for the given profile schedule.
 *
 * @param {{ enabled: boolean, rules: Array<{days: number[], startTime: string, endTime: string}> }} schedule
 * @returns {boolean}
 */
export function isScheduleActive(schedule) {
  if (!schedule) return true; // defensive: treat missing schedule as always-block

  // Toggle off = block all day, no time window restriction
  if (!schedule.enabled) return true;

  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const currentMins = now.getHours() * 60 + now.getMinutes();

  for (const rule of schedule.rules ?? []) {
    if (!rule.days.includes(day)) continue;

    const start = toMinutes(rule.startTime);
    const end = toMinutes(rule.endTime);

    // Zero-length window (start === end) is treated as disabled/no-op, not all-day
    if (start === end) continue;

    if (end < start) {
      // Midnight-crossing window (e.g. 22:00 → 06:00)
      if (currentMins >= start || currentMins < end) return true;
    } else {
      if (currentMins >= start && currentMins < end) return true;
    }
  }

  return false;
}
