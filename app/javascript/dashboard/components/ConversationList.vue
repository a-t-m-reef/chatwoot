<script setup>
import { ref, computed, provide } from 'vue';
import { Virtualizer } from 'virtua/vue';
import { useBreakpoints } from '@vueuse/core';
import { useChatListKeyboardEvents } from 'dashboard/composables/chatlist/useChatListKeyboardEvents';
import ConversationItem from './ConversationItem.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';
import IntersectionObserver from 'dashboard/components/IntersectionObserver.vue';

import wootConstants from 'dashboard/constants/globals';

const props = defineProps({
  conversationList: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  showEndOfListMessage: { type: Boolean, default: false },
  label: { type: String, default: '' },
  teamId: { type: [String, Number], default: 0 },
  foldersId: { type: [String, Number], default: 0 },
  conversationType: { type: String, default: '' },
  showAssignee: { type: Boolean, default: false },
  isOnExpandedLayout: { type: Boolean, default: false },
});

const emit = defineEmits(['loadMore']);

const conversationListRef = ref(null);
const virtualListRef = ref(null);
const isContextMenuOpen = ref(false);

provide('contextMenuElementTarget', virtualListRef);

const breakpoints = useBreakpoints({
  lg: wootConstants.LARGE_SCREEN_BREAKPOINT,
});
const isLgScreen = breakpoints.greaterOrEqual('lg');
const showExpandedCards = computed(
  () => props.isOnExpandedLayout && isLgScreen.value
);

// Time-bucket label for a conversation timestamp (unix seconds).
const ONE_DAY_S = 86400;
const bucketFor = ts => {
  if (!ts) return 'No date';
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (ts >= startOfToday.getTime() / 1000) return 'Today';
  const diffDays = (Date.now() / 1000 - ts) / ONE_DAY_S;
  if (diffDays < 8) return 'This Week';
  if (diffDays < 15) return '1-2 Weeks';
  if (diffDays < 31) return '2-4 Weeks';
  return 'Over a Month';
};

const BUCKET_ORDER = [
  'Today',
  'This Week',
  '1-2 Weeks',
  '2-4 Weeks',
  'Over a Month',
  'No date',
];

// Group conversations by time bucket, then render the buckets in fixed order
// with one header each. Conversations within a bucket keep their original
// relative order (so Chatwoot's chosen sort still applies inside each group).
const groupedList = computed(() => {
  const groups = Object.fromEntries(BUCKET_ORDER.map(k => [k, []]));
  props.conversationList.forEach(chat => {
    const b = bucketFor(chat?.timestamp);
    if (groups[b]) groups[b].push(chat);
  });
  return BUCKET_ORDER.flatMap(label =>
    groups[label].length
      ? [{ __header: true, label, key: `__h_${label}` }, ...groups[label]]
      : []
  );
});

useChatListKeyboardEvents(conversationListRef);

const intersectionObserverOptions = computed(() => ({
  root: conversationListRef.value,
  rootMargin: '100px 0px 100px 0px',
}));

const onContextMenuToggle = state => {
  isContextMenuOpen.value = state;
};

const loadMoreConversations = () => {
  emit('loadMore');
};

provide('toggleContextMenu', onContextMenuToggle);

defineExpose({ conversationListRef });
</script>

<template>
  <div
    ref="conversationListRef"
    class="flex-1 min-h-0 overflow-y-auto conversations-list"
    :class="{ '!overflow-hidden': isContextMenuOpen }"
  >
    <Virtualizer
      ref="virtualListRef"
      v-slot="{ item }"
      :data="groupedList"
      class="[&>div:has(+_div_.active)>*]:!border-n-surface-1 [&>div:has(+_div_.selected)>*]:!border-n-surface-1"
    >
      <div
        v-if="item.__header"
        class="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-n-slate-11 bg-n-slate-2 border-b border-n-slate-3 sticky top-0 z-10"
      >
        {{ item.label }}
      </div>
      <ConversationItem
        v-else
        :source="item"
        :label="label"
        :team-id="teamId"
        :folders-id="foldersId"
        :conversation-type="conversationType"
        :show-assignee="showAssignee"
        :show-expanded="showExpandedCards"
      />
    </Virtualizer>
    <div v-if="isLoading" class="flex justify-center my-4">
      <Spinner class="text-n-brand" />
    </div>
    <p v-else-if="showEndOfListMessage" class="p-4 text-center text-n-slate-11">
      {{ $t('CHAT_LIST.EOF') }}
    </p>
    <IntersectionObserver
      v-else
      :options="intersectionObserverOptions"
      @observed="loadMoreConversations"
    />
  </div>
</template>
