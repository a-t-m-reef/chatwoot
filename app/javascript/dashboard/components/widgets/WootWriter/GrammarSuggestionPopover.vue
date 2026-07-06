<script setup>
// Suggestion popover for the composer grammar/spell autocorrect (business to-do #37).
// Shown when an agent clicks a wavy-underlined word. Lists the flagged issue and its
// suggested replacements; picking one applies the fix, "Ignore" hides it for the session.
// Positioning uses a dynamic :style (fixed, viewport coords) the same way the image
// resize toolbar in Editor.vue does, since a floating anchor needs runtime coordinates.
// The reply composer sits at the bottom of the panel, so after mount we measure the
// popover and flip it above the word / clamp it into the viewport instead of letting it
// (and its Ignore button) render below the fold.
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  lint: { type: Object, required: true },
  // { left, top, bottom } from EditorView.coordsAtPos, in viewport pixels.
  coords: { type: Object, default: null },
});

const emit = defineEmits(['apply', 'ignore']);

const { t } = useI18n();

const MAX_SUGGESTIONS = 5;
const VIEWPORT_MARGIN = 8;

const popoverRef = ref(null);
// Start at the raw anchor (below the word) so the first paint is roughly right, then
// refine once we can measure the rendered size.
const placement = ref({
  left: props.coords?.left ?? 0,
  top: props.coords?.bottom ?? 0,
});

const positionStyle = computed(() => ({
  left: `${placement.value.left}px`,
  top: `${placement.value.top}px`,
}));

async function reposition() {
  if (!props.coords) return;
  await nextTick();
  const el = popoverRef.value;
  if (!el) return;
  const { width, height } = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = props.coords.left;
  let top = props.coords.bottom;
  // Flip above the word if opening below would overflow the viewport bottom.
  if (top + height + VIEWPORT_MARGIN > vh) {
    top = props.coords.top - height;
  }
  // Clamp into the viewport on both axes.
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, vw - width - VIEWPORT_MARGIN)
  );
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - height - VIEWPORT_MARGIN));
  placement.value = { left, top };
}

onMounted(reposition);
watch(() => props.coords, reposition);

const replacements = computed(() =>
  (props.lint.suggestions || [])
    .filter(
      suggestion => suggestion.kind === 'replace' && suggestion.replacement
    )
    .slice(0, MAX_SUGGESTIONS)
);
</script>

<template>
  <div
    ref="popoverRef"
    class="fixed z-50 flex flex-col min-w-[12rem] max-w-xs gap-0.5 px-1.5 py-1.5 overflow-y-auto max-h-[60vh] rounded-lg shadow-lg bg-n-solid-3 outline outline-1 outline-n-weak"
    :style="positionStyle"
  >
    <p class="px-1.5 pt-0.5 pb-1 m-0 text-xs text-n-slate-11">
      {{ lint.message }}
    </p>
    <button
      v-for="(suggestion, index) in replacements"
      :key="index"
      class="flex items-center px-1.5 py-1 text-sm font-medium text-left rounded-md text-n-slate-12 hover:bg-n-slate-4"
      @click="emit('apply', suggestion.replacement)"
    >
      {{ suggestion.replacement }}
    </button>
    <div v-if="replacements.length" class="h-px my-0.5 bg-n-weak" />
    <button
      class="px-1.5 py-1 text-xs text-left rounded-md text-n-slate-11 hover:bg-n-slate-4"
      @click="emit('ignore')"
    >
      {{ t('CONVERSATION.REPLYBOX.GRAMMAR.IGNORE') }}
    </button>
  </div>
</template>
