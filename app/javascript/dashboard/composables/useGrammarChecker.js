/*
 * useGrammarChecker (L034 Chatwoot autocorrect, business to-do #37).
 *
 * Owns ONE Harper Web Worker for the whole browser tab, created lazily on first use and
 * shared across every composer instance and conversation switch. The worker is heavy
 * (it carries the inlined Harper WASM), and the composer rebuilds its ProseMirror plugin
 * list frequently (on every draft/channel/private-note change), so the worker must live
 * OUTSIDE the plugin factory or it would be re-instantiated constantly.
 *
 * `checkText` correlates each request/response by a monotonically increasing `seq`;
 * callers that want to drop stale results track their own supersede sequence.
 */

let worker = null;
let seq = 0;
const pending = new Map(); // seq -> resolve

function handleMessage(event) {
  const { seq: responseSeq, lints, error } = event.data || {};
  const resolve = pending.get(responseSeq);
  if (!resolve) return;
  pending.delete(responseSeq);
  resolve(error ? [] : lints);
}

function handleError() {
  // A worker-level failure would otherwise leave every caller hanging. Resolve all
  // in-flight requests with "no lints" so the composer simply shows no underlines, and
  // drop the dead worker so the NEXT check recreates a fresh one (otherwise every later
  // postMessage would go into a worker that never replies and hang its promise forever).
  pending.forEach(resolve => resolve([]));
  pending.clear();
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

function ensureWorker() {
  if (worker) return worker;
  // The `new URL(...)` MUST stay inline inside `new Worker(...)`: Vite's worker plugin
  // only recognizes (and bundles) a worker when it matches that exact inline shape.
  // Hoisting the URL to a variable makes Vite emit it as an unbundled `data:` URL whose
  // imports never resolve, silently killing the feature in the production build.
  worker = new Worker(
    new URL('../helper/textCorrect/harper.worker.js', import.meta.url),
    { type: 'module' }
  );
  worker.onmessage = handleMessage;
  worker.onerror = handleError;
  return worker;
}

/**
 * Check `text` for grammar/spell/brand issues.
 * @param {string} text plaintext extracted from the composer doc
 * @param {string[]} [customWords] session-ignored terms to never flag
 * @returns {Promise<Array>} resolved lints (empty array on error)
 */
export function checkText(text, customWords = []) {
  const activeWorker = ensureWorker();
  const requestSeq = seq;
  seq += 1;
  return new Promise(resolve => {
    pending.set(requestSeq, resolve);
    activeWorker.postMessage({
      seq: requestSeq,
      text,
      ignoredWords: customWords,
    });
  });
}

/** Tear the shared worker down (e.g. on full app teardown). Safe to call when idle. */
export function terminateGrammarChecker() {
  handleError();
}

export function useGrammarChecker() {
  return { checkText, terminateGrammarChecker };
}
