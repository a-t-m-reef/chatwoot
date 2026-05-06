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

// Time-bucket label for a conversation, based on its actual sort key
// (last_activity_at). Uses date-fns helpers so today/yesterday respect
// local timezone and DST without manual epoch arithmetic.
const bucketForChat = chat => {
  const ts = chat?.last_activity_at || chat?.created_at;
  if (!ts) return null;
  const date = fromUnixTime(ts);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  const days = differenceInDays(new Date(), date);
  if (days < 7) return 'This Week';
  if (days < 30) return 'This Month';
  return 'Older';
};

// Headers only make sense in the default last-activity-DESC sort. With a
// different sort selected by the user (waiting_since, priority, etc.) the
// list is no longer monotonic in time, so showing headers would produce
// nonsense. Hide them in that case and just render the plain list.
const store = useStore();
const chatSortFilter = computed(() => store.getters.getChatSortFilter);

const groupedList = computed(() => {
  if (
    chatSortFilter.value !== wootConstants.SORT_BY_TYPE.LAST_ACTIVITY_AT_DESC
  ) {
    return props.conversationList;
  }
  let prev = null;
  return props.conversationList.flatMap(chat => {
    const bucket = bucketForChat(chat);
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
