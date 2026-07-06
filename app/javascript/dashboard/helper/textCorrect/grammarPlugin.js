/*
 * ProseMirror grammar/spell/brand decoration plugin (L034 Chatwoot autocorrect, #37).
 *
 * Paints Grammarly-style wavy underlines under flagged spans and opens a suggestion
 * popover on click. It is a DISPLAY-ONLY overlay: it never mutates the doc to show an
 * error (which would fight the caret, IME and undo), so it is safe to run live in the
 * composer. The doc is only touched when the agent applies a fix, via a single normal
 * transaction (so native undo works).
 *
 * Flow: on doc change (debounced) it extracts plaintext + an offset map, asks the shared
 * Harper worker to check it, then RE-WALKS the current doc and re-verifies each lint's
 * surface text before painting, so a stale async result can never underline the wrong
 * characters. Decorations map through intervening edits until the next check replaces them.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import {
  buildPlainAndSegments,
  offsetToPos,
  findNearest,
  textBetweenAsPlain,
} from './offsetMap';

export const grammarPluginKey = new PluginKey('grammar');

const DEBOUNCE_MS = 400;
// Above this length the composer is a long-form draft where per-keystroke re-checking is
// wasteful and the underline value is low; skip checking (matches the Element cutoff).
const MAX_TEXT_LENGTH = 5000;

// Full literal Tailwind class strings so the JIT scanner (which reads this file per
// tailwind.config.js content globs) emits the wavy-underline utilities. `decoration-wavy`
// + `decoration-n-*-9` render the squiggle in the theme colour; the arbitrary property
// keeps it unbroken across descenders. Do not build these by interpolation.
const UNDERLINE_BASE =
  'underline decoration-wavy underline-offset-2 [text-decoration-skip-ink:none] cursor-pointer';
const UNDERLINE_CLASSES = {
  spelling: `${UNDERLINE_BASE} decoration-n-ruby-9`,
  brand: `${UNDERLINE_BASE} decoration-n-teal-9`,
  style: `${UNDERLINE_BASE} decoration-n-amber-9`,
  grammar: `${UNDERLINE_BASE} decoration-n-blue-9`,
};

function classForLint(lint) {
  if (lint.source === 'brand' || lint.kind === 'brand')
    return UNDERLINE_CLASSES.brand;
  if (lint.kind === 'spelling') return UNDERLINE_CLASSES.spelling;
  if (lint.kind === 'style') return UNDERLINE_CLASSES.style;
  // grammar, punctuation, capitalization, repetition, other
  return UNDERLINE_CLASSES.grammar;
}

/**
 * Build the plugin.
 * @param {object} opts
 * @param {(text:string, words:string[])=>Promise<Array>} opts.check the worker client
 * @param {()=>string[]} opts.getCustomWords session-ignored terms to skip
 * @param {(payload:{lint:object, from:number, to:number, coords:object|null})=>void} opts.onLintClick
 * @param {object} [opts.controller] mutable holder; the plugin attaches `recheck`/`clear`
 *   so the host component can force a re-check (e.g. after "Ignore") or wipe underlines.
 */
export function createGrammarPlugin({
  check,
  getCustomWords,
  onLintClick,
  controller,
}) {
  return new Plugin({
    key: grammarPluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, oldSet) {
        const meta = tr.getMeta(grammarPluginKey);
        if (meta) {
          if (meta.clear) return DecorationSet.empty;
          if (meta.decorations) return meta.decorations;
        }
        // No new results this transaction: keep the underlines but move them with the
        // edit so they stay on their words until the next debounced check refreshes them.
        return oldSet.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return grammarPluginKey.getState(state);
      },
      handleClickOn(view, pos) {
        if (!onLintClick) return false;
        const set = grammarPluginKey.getState(view.state);
        if (!set) return false;
        const found = set
          .find(Math.max(0, pos - 1), pos + 1)
          .filter(d => d.spec && d.spec.lint && pos >= d.from && pos <= d.to);
        const deco = found[0];
        if (!deco) return false;
        let coords = null;
        try {
          coords = view.coordsAtPos(deco.from);
        } catch (e) {
          coords = null;
        }
        onLintClick({
          lint: deco.spec.lint,
          from: deco.from,
          to: deco.to,
          coords,
        });
        return true;
      },
    },
    view(editorView) {
      let timer = null;
      let runSeq = 0;
      let destroyed = false;

      const decorationForLint = (doc, plain, segments, lint) => {
        let from = offsetToPos(segments, lint.start);
        let to = offsetToPos(segments, lint.end);
        if (from == null || to == null || to <= from) return null;
        // Verify the mapped range actually holds the flagged text before painting.
        // Uses the same separators as the checker's plaintext (textBetweenAsPlain) so a
        // lint spanning a line break or atom verifies; absorbs any residual offset drift
        // (e.g. around emoji) via relocation.
        if (textBetweenAsPlain(doc, from, to) !== lint.problem) {
          const idx = findNearest(plain, lint.problem, lint.start);
          if (idx < 0) return null;
          from = offsetToPos(segments, idx);
          to = offsetToPos(segments, idx + lint.problem.length);
          const stillWrong =
            from == null ||
            to == null ||
            textBetweenAsPlain(doc, from, to) !== lint.problem;
          if (stillWrong) return null;
        }
        return Decoration.inline(
          from,
          to,
          { class: classForLint(lint) },
          { lint }
        );
      };

      const paint = (view, lints) => {
        const { plain, segments } = buildPlainAndSegments(view.state.doc);
        const { doc } = view.state;
        const decos = lints
          .map(lint => decorationForLint(doc, plain, segments, lint))
          .filter(Boolean);
        view.dispatch(
          view.state.tr.setMeta(grammarPluginKey, {
            decorations: DecorationSet.create(doc, decos),
          })
        );
      };

      const runCheck = async view => {
        const checkedDoc = view.state.doc;
        const { plain } = buildPlainAndSegments(checkedDoc);
        if (plain.trim().length === 0 || plain.length > MAX_TEXT_LENGTH) {
          view.dispatch(
            view.state.tr.setMeta(grammarPluginKey, { clear: true })
          );
          return;
        }
        runSeq += 1;
        const mySeq = runSeq;
        const lints = await check(plain, getCustomWords());
        if (destroyed || mySeq !== runSeq) return; // torn down or superseded
        // The doc was edited during the worker round-trip: these lints are for a stale
        // version and a fresh check is already scheduled, so skip painting them (avoids
        // relocating a lint onto a different, identical occurrence for one debounce).
        if (view.state.doc !== checkedDoc) return;
        paint(view, lints);
      };

      const schedule = view => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => runCheck(view), DEBOUNCE_MS);
      };

      if (controller) {
        controller.recheck = () => schedule(editorView);
        controller.clear = () =>
          editorView.dispatch(
            editorView.state.tr.setMeta(grammarPluginKey, { clear: true })
          );
      }

      // Initial pass (e.g. a loaded draft already has content).
      schedule(editorView);

      return {
        update(view, prevState) {
          if (!view.state.doc.eq(prevState.doc)) schedule(view);
        },
        destroy() {
          destroyed = true;
          if (timer) clearTimeout(timer);
          if (controller) {
            controller.recheck = () => {};
            controller.clear = () => {};
          }
        },
      };
    },
  });
}
