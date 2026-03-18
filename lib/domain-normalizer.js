/**
 * domain-normalizer.js
 *
 * Converts loose user input to a canonical domain string ready for storage.
 *
 * Examples:
 *   'facebook'           → 'facebook.com'
 *   'www.reddit.com'     → 'reddit.com'
 *   'YouTube'            → 'youtube.com'
 *   'https://x.com/foo'  → 'x.com'
 *   'sub.example.co.uk'  → 'sub.example.co.uk'
 */

/**
 * @param {string} input
 * @returns {string} canonical domain, or empty string if input is blank
 */
export function normalizeDomain(input) {
  let d = (input ?? '').trim().toLowerCase();
  if (!d) return '';

  // Strip protocol
  d = d.replace(/^https?:\/\//, '');

  // Strip www. prefix
  d = d.replace(/^www\./, '');

  // Strip path, query, fragment — keep only hostname
  d = d.split(/[/?#]/)[0];

  // Strip trailing dot (FQDN notation)
  d = d.replace(/\.$/, '');

  // If no dot remains, treat as a plain name and append .com
  if (!d.includes('.')) d = `${d}.com`;

  return d;
}

/**
 * Returns true if the string looks like a valid domain after normalisation.
 * @param {string} domain already-normalised domain
 * @returns {boolean}
 */
export function isValidDomain(domain) {
  // at least one dot, no spaces, no consecutive dots, no slashes, no protocol, reasonable length
  return (
    typeof domain === 'string' &&
    domain.length > 0 &&
    domain.length <= 253 &&
    domain.includes('.') &&
    !domain.includes('..') &&
    /^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?$/.test(domain)
  );
}
