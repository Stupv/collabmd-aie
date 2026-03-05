/**
 * Shared utilities for vault file operations and HTML escaping.
 */

/**
 * Escapes HTML special characters to prevent XSS when inserting user-supplied
 * text into the DOM via innerHTML.
 *
 * @param {string} text — raw text to escape
 * @returns {string} HTML-safe string
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Resolves a wiki-link target (e.g. "My Note") to an existing vault file path.
 *
 * Matching rules (in order):
 *   1. Exact path match (with .md appended if missing)
 *   2. Filename match at any directory depth
 *   3. Path without .md extension matches the target
 *
 * @param {string} target — the raw wiki-link target text
 * @param {string[]} files — list of vault file paths
 * @returns {string | undefined} matched file path, or undefined if unresolved
 */
export function resolveWikiTarget(target, files) {
  const normalized = target.endsWith('.md') ? target : `${target}.md`;
  return files.find((f) => (
    f === normalized || f.endsWith(`/${normalized}`) || f.replace(/\.md$/i, '') === target
  ));
}

/**
 * Clamps a numeric value between a minimum and maximum bound.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
