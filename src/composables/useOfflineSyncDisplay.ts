import { ref, computed, watch } from 'vue';
import { useOfflineManager } from '@/composables/useOfflineManager';
import { ImageService } from '@/services/image.service';
import storageService from '@/services/storage.service';

export interface OfflineQueueDisplayItem {
  id: number | string;
  data?: any;
  imageFiles?: string[];
  thumb?: string | null;
}

export interface OfflineQueueGroup {
  key: string;
  psId: number | null;
  items: OfflineQueueDisplayItem[];
}

const thumbCache = new Map<string, string | null>();

export function useSyncBadgeCount() {
  const { pendingItems, loadPendingItems } = useOfflineManager();

  const syncBadgeCount = computed(() => pendingItems.value.length);

  return { syncBadgeCount, loadPendingItems, pendingItems };
}

export function useOfflineSyncDisplay(getCheckpointName: (cpId: string) => string) {
  const { pendingItems, loadPendingItems, cleanUpItem } = useOfflineManager();

  const displayItems = ref<OfflineQueueDisplayItem[]>([]);
  const isRefreshing = ref(false);

  const seedItems = (items: OfflineQueueDisplayItem[]): OfflineQueueDisplayItem[] =>
    items.map((item) => {
      const file = item.imageFiles?.[0];
      return {
        ...item,
        thumb: file ? (thumbCache.get(file) ?? null) : null,
      };
    });

  const enrichThumbs = async (items: OfflineQueueDisplayItem[]) => {
    const snapshotIds = items.map((i) => i.id).join('|');
    const enriched = await Promise.all(
      items.map(async (item) => {
        const file = item.imageFiles?.[0];
        if (!file) return { ...item, thumb: null };
        if (thumbCache.has(file)) {
          return { ...item, thumb: thumbCache.get(file) ?? null };
        }
        const url = await ImageService.getDisplayUrl(file);
        thumbCache.set(file, url);
        return { ...item, thumb: url };
      })
    );
    // Tránh ghi đè nếu queue đã đổi trong lúc lấy URI
    const currentIds = displayItems.value.map((i) => i.id).join('|');
    if (currentIds === snapshotIds) {
      displayItems.value = enriched;
    }
  };

  const groupedItems = computed<OfflineQueueGroup[]>(() => {
    const map = new Map<string, OfflineQueueGroup>();
    for (const item of displayItems.value) {
      const rawPsId = item.data?.psId;
      const hasPsId = rawPsId !== null && rawPsId !== undefined && rawPsId !== '';
      const psId = hasPsId ? Number(rawPsId) : null;
      const key = hasPsId ? `ps_${psId}` : 'ps_unknown';
      if (!map.has(key)) {
        map.set(key, { key, psId, items: [] });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values());
  });

  /** Seed list ngay từ RAM → load queue nhanh → thumb nền → sanitize nền */
  const refreshDisplayItems = async () => {
    isRefreshing.value = true;
    try {
      // 1) Seed tức thì nếu RAM đã có (Home/Route vừa load)
      if (pendingItems.value.length > 0) {
        displayItems.value = seedItems(pendingItems.value);
        isRefreshing.value = false;
        void enrichThumbs(displayItems.value);
      }

      // 2) Reload queue không sanitize (nhanh)
      await loadPendingItems();
      displayItems.value = seedItems(pendingItems.value);
      isRefreshing.value = false;
      void enrichThumbs(displayItems.value);

      // 3) Sanitize nền — cập nhật list nếu có item bị dọn
      void loadPendingItems({ sanitize: true }).then(() => {
        displayItems.value = seedItems(pendingItems.value);
        void enrichThumbs(displayItems.value);
      });
    } catch (e) {
      console.error('[OfflineSyncDisplay] refreshDisplayItems:', e);
      isRefreshing.value = false;
    }
  };

  watch(
    pendingItems,
    (newQueue) => {
      displayItems.value = seedItems(newQueue);
      void enrichThumbs(newQueue);
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
    groupedItems,
    isRefreshing,
    refreshDisplayItems,
    deleteItem,
    getCheckpointName,
  };
}
