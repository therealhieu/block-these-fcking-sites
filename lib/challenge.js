/**
 * challenge.js — shared typing-challenge verification logic.
 *
 * Normalisation: trim + collapse internal whitespace.
 * Intentionally case-SENSITIVE to preserve typing friction.
 */

/**
 * @param {string} s
 * @returns {string}
 */
function normalise(s) {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Returns true if typed matches expected after whitespace normalisation.
 * @param {string} expected  configured challenge text
 * @param {string} typed     what the user typed
 * @returns {boolean}
 */
export function verifyTypingChallenge(expected, typed) {
  return normalise(expected) === normalise(typed);
}
