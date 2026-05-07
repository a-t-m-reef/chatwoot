<script setup>
import { ref, computed, provide } from 'vue';
import { useStore } from 'vuex';
import { fromUnixTime, differenceInDays, isToday, isYesterday } from 'date-fns';
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

// Time-bucket label for a unix-seconds timestamp. Uses date-fns helpers so
// today / yesterday respect local timezone and DST.
const bucketForTimestamp = ts => {
  if (!ts) return null;
  const date = fromUnixTime(ts);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  const days = differenceInDays(new Date(), date);
  if (days < 7) return 'This Week';
  if (days < 30) return 'This Month';
  return 'Older';
};

// Sorts where the bucket headers make sense (newest at top, monotonic in time).
// We re-sort the displayed list by last_activity_at DESC ourselves so the bucket
// label always agrees with the date shown on each card (TimeAgo reads
// last_activity_at). This avoids the "header says This Month, card says May 5,
// 1d" perceptual bug where bucket source and display source disagreed.
// For any other sort (waiting_since, priority, asc), the list isn't monotonic
// in time so we hide headers and pass the upstream list through unchanged.
const HEADER_FRIENDLY_SORTS = new Set([
  undefined,
  wootConstants.SORT_BY_TYPE.LAST_ACTIVITY_AT_DESC,
  wootConstants.SORT_BY_TYPE.CREATED_AT_DESC,
]);

const store = useStore();
const chatSortFilter = computed(() => store.getters.getChatSortFilter);

// Use last_inbound_at (most recent customer message) so an outgoing reply
// from us doesn't bump the conversation. Falls back to created_at when no
// inbound exists (e.g. agent-initiated threads, system notifications).
const lastActivityTs = chat => chat?.last_inbound_at || chat?.created_at || 0;

const groupedList = computed(() => {
  if (!HEADER_FRIENDLY_SORTS.has(chatSortFilter.value)) {
    return props.conversationList;
  }

  const sorted = [...props.conversationList].sort(
    (a, b) => lastActivityTs(b) - lastActivityTs(a)
  );

  let prev = null;
  return sorted.flatMap(chat => {
    const bucket = bucketForTimestamp(lastActivityTs(chat));
    if (!bucket || bucket === prev) return [chat];
    prev = bucket;
    return [{ __header: true, label: bucket, key: `__h_${bucket}` }, chat];
  });
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
      <div>
        <div
          v-if="item.__header"
          class="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-n-slate-11 bg-n-slate-2 border-b border-n-slate-3"
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
      </div>
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
