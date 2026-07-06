/*
 * The shared correction engine (vendored from @element-hq/text-correct, L034).
 *
 * Wraps Harper (a `LocalLinter`, because callers run this inside a Web Worker where
 * blocking is fine) and merges in the brand-lexicon pass. Returns plain, framework-
 * agnostic objects: all Harper WASM handles are freed here, so nothing WASM-bound
 * crosses the API boundary (safe to postMessage back to the main thread).
 *
 * A "Lint" is: { start, end, kind, message, problem, suggestions:[{replacement,kind}], source }.
 * Offsets are UTF-16 code-unit indices into the exact text passed to check().
 */

import { LocalLinter, SuggestionKind } from 'harper.js';

import { PROTECTED_TERMS } from './brandLexicon';
import { brandLints } from './normalize';

function mapKind(harperKind) {
  switch (harperKind) {
    case 'Spelling':
    case 'Typo':
      return 'spelling';
    case 'Capitalization':
      return 'capitalization';
    case 'Repetition':
    case 'Redundancy':
      return 'repetition';
    case 'Punctuation':
    case 'Formatting':
    case 'BoundaryError':
      return 'punctuation';
    case 'Style':
    case 'Readability':
    case 'Enhancement':
    case 'Miscellaneous':
      return 'style';
    case 'Agreement':
    case 'Grammar':
    case 'Usage':
    case 'WordChoice':
    case 'Malapropism':
    case 'Eggcorn':
    case 'Nonstandard':
    case 'Regionalism':
      return 'grammar';
    default:
      return 'other';
  }
}

function mapSuggestionKind(kind) {
  switch (kind) {
    case SuggestionKind.Remove:
      return 'remove';
    case SuggestionKind.Replace:
      return 'replace';
    default:
      return 'insert';
  }
}

/**
 * @param {{ binary: any, dialect?: any, customWords?: string[] }} opts
 * @returns {Promise<{ check: (text:string, ignoredWords?:string[])=>Promise<Array> }>}
 */
export async function createChecker(opts) {
  const linter = new LocalLinter({
    binary: opts.binary,
    dialect: opts.dialect,
  });
  await linter.setup();

  const seed = [...PROTECTED_TERMS, ...(opts.customWords ?? [])];
  if (seed.length > 0) await linter.importWords(seed);

  return {
    async check(text, ignoredWords = []) {
      const raw = await linter.lint(text, { language: 'plaintext' });
      const out = raw.map(l => {
        const span = l.span();
        const { start, end } = span;
        span.free();

        const suggestions = l.suggestions().map(s => {
          const mapped = {
            replacement: s.get_replacement_text(),
            kind: mapSuggestionKind(s.kind()),
          };
          s.free();
          return mapped;
        });

        const lint = {
          start,
          end,
          kind: mapKind(l.lint_kind()),
          message: l.message(),
          problem: l.get_problem_text(),
          suggestions,
          source: 'harper',
        };
        l.free();
        return lint;
      });

      // Brand corrections are the curated, authoritative source, so they take PRECEDENCE
      // over Harper (L034). Compute them independently (not suppressed by Harper), then
      // drop any Harper lint that overlaps a brand lint, so the curated suggestion wins
      // (e.g. "molokni" -> "Molokini", not Harper's "Molokai").
      const brand = brandLints(text, []);
      const overlaps = (a, b) => !(a.end <= b.start || a.start >= b.end);
      const merged = out.filter(h => !brand.some(b => overlaps(h, b)));
      merged.push(...brand);
      merged.sort((a, b) => a.start - b.start || a.end - b.end);

      // Per-request "Ignore" list: drop any lint (brand OR Harper) whose flagged surface
      // text the agent has chosen to ignore. Done here (not via importWords) so it covers
      // brand + grammar lints and stays scoped/reversible per request.
      if (ignoredWords.length === 0) return merged;
      const ignore = new Set(ignoredWords.map(w => w.toLowerCase()));
      return merged.filter(l => !ignore.has(l.problem.toLowerCase()));
    },
  };
}
