/*
 * Harper grammar/spell Web Worker (L034 Chatwoot autocorrect, business to-do #37).
 *
 * Runs the vendored @element-hq/text-correct engine (Harper + brand lexicon) off the
 * main thread so the composer UI never blocks. Uses harper.js `binaryInlined` (WASM
 * base64-inlined into this worker chunk): a single fetch with no separate .wasm asset
 * and no dependency on the server sending `application/wasm`, at the cost of a larger
 * worker bundle. The worker is constructed lazily on the first check (i.e. the first
 * time an agent types in a reply with grammar checking active), so the chunk is only
 * fetched once per tab and never at all for an agent who turns the setting off.
 *
 * Protocol: main thread posts { seq, text, ignoredWords }, worker replies
 * { seq, lints, error }. `seq` lets the caller drop superseded (stale) responses.
 * All Harper WASM handles are freed inside the engine, so only plain objects cross.
 */

/* global globalThis */
import { binaryInlined } from 'harper.js/binaryInlined';

import { createChecker } from './checker';

let checkerPromise = null;

function getChecker() {
  if (!checkerPromise) {
    checkerPromise = createChecker({ binary: binaryInlined });
  }
  return checkerPromise;
}

globalThis.addEventListener('message', async event => {
  const { seq, text, ignoredWords = [] } = event.data;
  try {
    const checker = await getChecker();
    // ignoredWords are filtered per-request inside check(), NOT imported into the shared
    // linter dictionary. This keeps "Ignore" scoped to the composer that requested it,
    // reversible, and effective for brand lints too (importWords only silences Harper's
    // spelling dictionary, never the brand pass or Harper's grammar rules).
    const lints = await checker.check(text, ignoredWords);
    globalThis.postMessage({ seq, lints });
  } catch (e) {
    globalThis.postMessage({ seq, lints: [], error: String(e) });
  }
});
