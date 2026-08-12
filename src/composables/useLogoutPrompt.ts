import { ref, watch } from 'vue';
import store from '@/composables/useVuex';
import storageService from '@/services/storage.service';
import { speakImportantText } from '@/services/ttsService';

const AWAITING_LOGOUT_KEY = 'awaiting_logout_after_sync';

/** Singleton — AreaCreate request mở modal logout trên Nav sau khi hoàn thành ca */
const logoutPromptRequested = ref(false);

/**
 * Đã hoàn thành ít nhất một ca nhưng còn pending lúc đó —
 * khi sync sạch + không còn ca unfinished mới hỏi logout.
 * Persist SQLite để sống sót qua live-reload / F5.
 */
const awaitingLogoutAfterSync = ref(false);

/** Tránh syncData + safeSync cùng mở modal / speak 2 lần */
let isPromptingLogout = false;

export async function markAwaitingLogoutAfterSync(): Promise<void> {
  awaitingLogoutAfterSync.value = true;
  try {
    await storageService.set(AWAITING_LOGOUT_KEY, true);
  } catch (e) {
    console.warn('[LogoutPrompt] Không lưu awaiting flag:', e);
  }
}

export const clearAwaitingLogoutAfterSync = () => {
  awaitingLogoutAfterSync.value = false;
  void storageService.remove(AWAITING_LOGOUT_KEY);
};

/** Hydrate cờ từ SQLite (gọi sau initApp / trước safeSync) */
export async function restoreAwaitingLogoutAfterSync(): Promise<boolean> {
  try {
    const saved = await storageService.get(AWAITING_LOGOUT_KEY);
    const isAwaiting = saved === true || saved === 'true' || saved === 1;
    awaitingLogoutAfterSync.value = isAwaiting;
    return isAwaiting;
  } catch (e) {
    console.warn('[LogoutPrompt] Không đọc awaiting flag:', e);
    return false;
  }
}

export const requestLogoutPrompt = () => {
  logoutPromptRequested.value = true;
};

const consumeLogoutPrompt = () => {
  logoutPromptRequested.value = false;
};

/** Đợi overlay sync tắt để Dialog logout không bị che (z-index) */
async function waitUntilSyncIdle(maxMs = 25000): Promise<void> {
  const start = Date.now();
  while (store.state.isSyncing && Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

/**
 * Gọi sau khi queue đã (có vẻ) sạch — chỉ mở modal nếu:
 * đang chờ sau hoàn thành ca + không unfinished + 3 queue = 0.
 */
export async function tryPromptLogoutAfterOfflineSync(options?: {
  pendingCount?: number;
  speakSuccess?: boolean;
}): Promise<boolean> {
  // Reload có thể mất RAM — đọc lại SQLite nếu cần
  if (!awaitingLogoutAfterSync.value) {
    await restoreAwaitingLogoutAfterSync();
  }
  if (!awaitingLogoutAfterSync.value) return false;

  // Đang làm ca tiếp theo — giữ cờ, không hỏi logout giữa chừng
  if (store.getters.isRouteUnfinished) return false;

  const pendingCount =
    options?.pendingCount ??
    ((await storageService.get('offline_api_queue')) || []).length;

  const deleteQueue = (await storageService.get('offline_delete_queue')) || [];
  const wrongScanQueue = (await storageService.get('offline_wrong_scan_queue')) || [];
  const totalUnsynced = pendingCount + deleteQueue.length + wrongScanQueue.length;

  if (totalUnsynced > 0) return false;

  if (isPromptingLogout) return false;
  isPromptingLogout = true;

  try {
    // Tránh mở modal dưới sync overlay
    await waitUntilSyncIdle();

    // Re-check sau khi đợi (user có thể bắt đầu ca mới / flag đã clear)
    if (!awaitingLogoutAfterSync.value) return false;
    if (store.getters.isRouteUnfinished) return false;

    if (options?.speakSuccess) {
      void speakImportantText('Đã gửi dữ liệu offline thành công. Vui lòng đăng xuất');
    }

    clearAwaitingLogoutAfterSync();
    requestLogoutPrompt();
    return true;
  } finally {
    isPromptingLogout = false;
  }
}

export function useLogoutPrompt() {
  return {
    logoutPromptRequested,
    awaitingLogoutAfterSync,
    requestLogoutPrompt,
    consumeLogoutPrompt,
    markAwaitingLogoutAfterSync,
    clearAwaitingLogoutAfterSync,
    restoreAwaitingLogoutAfterSync,
    tryPromptLogoutAfterOfflineSync,
  };
}

/** Dùng trong Nav: lắng nghe request và gọi openModal */
export function watchLogoutPrompt(openModal: () => void) {
  const { logoutPromptRequested } = useLogoutPrompt();

  watch(logoutPromptRequested, (requested) => {
    if (!requested) return;
    consumeLogoutPrompt();
    openModal();
  });
}
