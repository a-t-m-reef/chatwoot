/*
 * Plaintext <-> ProseMirror position mapping for the grammar autocorrect plugin (L034).
 *
 * The checker works on a flat plaintext string with UTF-16 character offsets. To paint
 * decorations and apply fixes we need to translate those offsets to ProseMirror document
 * positions. `buildPlainAndSegments` walks the doc once, producing BOTH the plaintext the
 * checker sees AND an ordered list of segments that each map a run of plaintext 1:1 onto a
 * contiguous PM range. `offsetToPos` then resolves any plaintext offset to a PM position.
 *
 * The map is intentionally NOT 1:1 at block boundaries: a single '\n' in the plaintext
 * corresponds to a 2-position PM gap (close token of one block + open token of the next),
 * so block separators are added to the plaintext but get NO segment.
 */

// Non-word placeholder emitted for opaque inline atoms (mention, tools, image). Harper
// treats U+FFFC (OBJECT REPLACEMENT CHARACTER) as a token boundary, so the words on
// either side of an atom stay independent instead of gluing together (e.g. "Hi@Bob").
const ATOM_PLACEHOLDER = '￼';
const BLOCK_SEPARATOR = '\n';

/**
 * Walk a ProseMirror doc once, building the checker's plaintext view and an offset map.
 * @param {import('prosemirror-model').Node} doc
 * @returns {{ plain: string, segments: Array<{ plainStart: number, pmPos: number, length: number }> }}
 */
export function buildPlainAndSegments(doc) {
  let plain = '';
  let acc = 0;
  let sawTextblock = false;
  const segments = [];

  doc.descendants((node, pos) => {
    if (node.isText) {
      segments.push({ plainStart: acc, pmPos: pos, length: node.text.length });
      plain += node.text;
      acc += node.text.length;
      return false;
    }
    if (node.isLeaf && node.isInline) {
      // mention / tools / inline image (opaque, nodeSize 1) and hard_break.
      const ch =
        node.type.name === 'hard_break' ? BLOCK_SEPARATOR : ATOM_PLACEHOLDER;
      segments.push({ plainStart: acc, pmPos: pos, length: 1 });
      plain += ch;
      acc += 1;
      return false;
    }
    if (node.isTextblock) {
      // Separate this block from the previous one so words don't merge across paragraphs.
      // The separator gets no segment (that is what creates the PM discontinuity).
      if (sawTextblock) {
        plain += BLOCK_SEPARATOR;
        acc += 1;
      }
      sawTextblock = true;
      return true;
    }
    // doc / blockquote / list containers: descend.
    return true;
  });

  return { plain, segments };
}

/**
 * Resolve a plaintext offset to a ProseMirror position using the segment map.
 * @param {Array<{ plainStart: number, pmPos: number, length: number }>} segments
 * @param {number} offset
 * @returns {number|null} the PM position, or null if there is nothing to map into.
 */
export function offsetToPos(segments, offset) {
  if (segments.length === 0) return null;

  // Binary-search for the segment whose [plainStart, plainStart+length] contains offset.
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const seg = segments[mid];
    if (offset < seg.plainStart) {
      hi = mid - 1;
    } else if (offset > seg.plainStart + seg.length) {
      lo = mid + 1;
    } else {
      return seg.pmPos + (offset - seg.plainStart);
    }
  }

  // Offset fell on a block-separator gap or past the end: clamp to the nearest segment
  // edge. `lo` now points just past the last segment whose start <= offset.
  const seg = segments[Math.min(lo, segments.length - 1)];
  if (offset < seg.plainStart) return seg.pmPos;
  return seg.pmPos + seg.length;
}

/**
 * Read the doc text of a PM range using the SAME separators buildPlainAndSegments emits
 * (block boundaries/hard_break -> '\n', inline atoms -> U+FFFC). This makes a
 * `textBetween === lint.problem` verification apples-to-apples, so a lint whose flagged
 * text spans a line break or an atom verifies instead of being spuriously dropped.
 * @param {import('prosemirror-model').Node} doc
 */
export function textBetweenAsPlain(doc, from, to) {
  return doc.textBetween(from, to, BLOCK_SEPARATOR, node =>
    node.type.name === 'hard_break' ? BLOCK_SEPARATOR : ATOM_PLACEHOLDER
  );
}

/**
 * Find the occurrence of `problem` in `text` nearest to `near`. Used to relocate a lint
 * when UTF-16-vs-Harper offset drift (e.g. around emoji) makes the raw offsets disagree
 * with the flagged surface text. Returns the start index, or -1 if not found.
 */
export function findNearest(text, problem, near) {
  if (problem.length === 0) return -1;
  const before = text.lastIndexOf(problem, near);
  const after = text.indexOf(problem, near);
  if (before < 0) return after;
  if (after < 0) return before;
  return near - before <= after - near ? before : after;
}
