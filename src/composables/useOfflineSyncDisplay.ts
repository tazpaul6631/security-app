import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { useOfflineManager } from '@/composables/useOfflineManager';
import { ImageService } from '@/services/image.service';
import storageService from '@/services/storage.service';

export interface OfflineQueueDisplayItem {
  id: number | string;
  data?: any;
  imageFiles?: string[];
  thumb?: string | null;
}

export function filterPendingByCurrentShift(
  items: OfflineQueueDisplayItem[],
  psId: number | null | undefined
): OfflineQueueDisplayItem[] {
  if (!psId) return items;
  return items.filter((item) => Number(item.data?.psId) === Number(psId));
}

export function useSyncBadgeCount() {
  const store = useStore();
  const { pendingItems, loadPendingItems } = useOfflineManager();

  const syncBadgeCount = computed(() =>
    filterPendingByCurrentShift(pendingItems.value, store.state.psId).length
  );

  return { syncBadgeCount, loadPendingItems, pendingItems };
}

export function useOfflineSyncDisplay(getCheckpointName: (cpId: string) => string) {
  const store = useStore();
  const { pendingItems, loadPendingItems, cleanUpItem } = useOfflineManager();

  const displayItems = ref<OfflineQueueDisplayItem[]>([]);
  const itemsPerPage = 10;
  const loadedCount = ref(itemsPerPage);

  const buildDisplayItems = async (items: OfflineQueueDisplayItem[]) => {
    const filtered = filterPendingByCurrentShift(items, store.state.psId);
    return Promise.all(
      filtered.map(async (item) => ({
        ...item,
        thumb: item.imageFiles?.[0]
          ? await ImageService.getDisplayUrl(item.imageFiles[0])
          : null,
      }))
    );
  };

  const paginatedItems = computed(() => displayItems.value.slice(0, loadedCount.value));

  const loadMoreOfflineItems = () => {
    loadedCount.value += itemsPerPage;
  };

  const refreshDisplayItems = async () => {
    await loadPendingItems({ sanitize: true });
    loadedCount.value = itemsPerPage;
    displayItems.value = await buildDisplayItems(pendingItems.value);
  };

  watch(
    () => pendingItems.value,
    async (newQueue) => {
      displayItems.value = await buildDisplayItems(newQueue);
    },
    { deep: true }
  );

  watch(
    () => store.state.psId,
    async () => {
      displayItems.value = await buildDisplayItems(pendingItems.value);
    }
  );

  const deleteItem = async (id: string | number) => {
    const queue = (await storageService.get('offline_api_queue')) || [];
    const item = queue.find((i: any) => i.id === id);
    if (!item) return;

    await cleanUpItem(item);
    await refreshDisplayItems();
  };

  return {
    displayItems,
    paginatedItems,
    loadedCount,
    loadMoreOfflineItems,
    refreshDisplayItems,
    deleteItem,
    getCheckpointName,
  };
}
