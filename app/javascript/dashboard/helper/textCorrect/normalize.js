/*
 * Brand-normalization pass (vendored from @element-hq/text-correct, L034).
 *
 * Harper does not know our product/place names, so we detect mistyped or wrong-cased
 * brand terms ourselves and emit synthetic lints that merge into Harper's output. This
 * is deterministic, meaning-safe, and never fires on already-correct text.
 */

import { BRAND_CORRECTIONS } from './brandLexicon';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A word token: letters/numbers plus internal apostrophes/hyphens. Unicode-aware.
const TOKEN_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

let compiled = null;

function compile() {
  if (compiled) return compiled;
  const single = new Map();
  const phrases = [];
  BRAND_CORRECTIONS.forEach(c => {
    // A `wrong === right` entry is a no-op that, under case-insensitive matching, turns
    // a correctly-capitalized sentence-start word into a lowercase "correction"
    // (anti-correction). Never emit lints for them (L034).
    if (c.wrong === c.right) return;
    if (/\s/.test(c.wrong)) {
      phrases.push({
        re: new RegExp(`\\b${escapeRegExp(c.wrong)}\\b`, 'giu'),
        right: c.right,
      });
    } else {
      single.set(c.wrong.toLowerCase(), c.right);
    }
  });
  compiled = { single, phrases };
  return compiled;
}

/** Does `[start,end)` overlap any span already present in `existing`? */
function overlaps(start, end, existing) {
  return existing.some(l => !(end <= l.start || start >= l.end));
}

/**
 * Produce brand-lexicon lints for `text`, skipping any span that overlaps an `existing`
 * (Harper) lint so we never double-underline the same word.
 * @returns {Array<{start:number,end:number,kind:string,message:string,problem:string,suggestions:Array<{replacement:string,kind:string}>,source:string}>}
 */
export function brandLints(text, existing) {
  const { single, phrases } = compile();
  const out = [];
  const claimed = [...existing];

  const addLint = (surface, right, start) => {
    const end = start + surface.length;
    if (surface === right || overlaps(start, end, claimed)) return;
    const lint = {
      start,
      end,
      kind: 'brand',
      message: `Did you mean “${right}”?`,
      problem: surface,
      suggestions: [{ replacement: right, kind: 'replace' }],
      source: 'brand',
    };
    out.push(lint);
    claimed.push(lint);
  };

  // Single-word tokens.
  Array.from(text.matchAll(TOKEN_RE)).forEach(m => {
    const surface = m[0];
    const right = single.get(surface.toLowerCase());
    if (right !== undefined) addLint(surface, right, m.index ?? 0);
  });

  // Multi-word phrases.
  phrases.forEach(({ re, right }) => {
    re.lastIndex = 0;
    Array.from(text.matchAll(re)).forEach(m => {
      addLint(m[0], right, m.index ?? 0);
    });
  });

  return out;
}
