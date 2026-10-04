'use strict';

/** Longer endings first so "woman" / "tales" win over "man" / "tale". */
const TITLE_ENDINGS = [
  'woman',
  'tales',
  'story',
  'verse',
  'force',
  'house',
  'world',
  'night',
  'wars',
  'land',
  'park',
  'home',
  'girl',
  'tale',
  'boy',
  'men',
  'man',
  'day',
];

function collapseSpaces(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function splitCamelCase(text) {
  return String(text)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

function splitTitleEnding(token) {
  if (!/^[A-Za-z0-9]+$/.test(token)) return null;
  const lower = token.toLowerCase();
  for (const ending of TITLE_ENDINGS) {
    if (lower.length > ending.length && lower.endsWith(ending)) {
      const cut = token.length - ending.length;
      return `${token.slice(0, cut)} ${token.slice(cut)}`;
    }
  }
  return null;
}

/**
 * Build search keyword variants to retry when the API returns no items.
 * Original stays first; then camelCase splits; then glued English title endings.
 */
function buildKeywordVariants(query) {
  const original = collapseSpaces(query);
  if (!original) return [];

  const variants = [];
  const seen = new Set();

  function add(value) {
    const next = collapseSpaces(value);
    if (!next) return;
    const key = next.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    variants.push(next);
  }

  add(original);
  add(splitCamelCase(original));

  if (/^[A-Za-z0-9]+$/.test(original)) {
    const ended = splitTitleEnding(original);
    if (ended) add(ended);
  }

  return variants;
}

module.exports = {
  TITLE_ENDINGS,
  collapseSpaces,
  splitCamelCase,
  splitTitleEnding,
  buildKeywordVariants,
};
