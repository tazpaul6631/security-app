<template>
  <div class="app-root">
    <div v-if="isAppLoading" class="app-loading-overlay">
      <div class="app-loading-box">
        <ProgressSpinner stroke-width="2" />
        <p v-if="loadingMessage" class="app-loading-message">{{ loadingMessage }}</p>
      </div>
    </div>

    <div v-if="store.state.isSyncing && store.state.syncMode === 'overlay'" class="sync-overlay">
      <div class="sync-box">
        <div class="sync-header">
          <span class="sync-label">
            {{ syncMessage }}
          </span>
          <span class="sync-percent">{{ syncProgressLabel }}</span>
        </div>
        <ProgressBar :value="store.state.syncProgress" :show-value="false" :pt="{
          root: { class: 'sync-progress-root' },
          value: { class: 'sync-progress-value' },
        }" />
      </div>
    </div>

    <router-view v-if="isAppReady" />
    <Toast position="top-center" :pt="{
      root: { class: 'app-toast' }
    }" />
  </div>
</template>

<script setup lang="ts">
import { ProgressBar, ProgressSpinner, Toast } from '@/plugins/primevue.components';
import { computed, onMounted, ref } from 'vue';
import { useSQLite } from '@/composables/useSQLite';
import { isAppLoading, useAppLoading } from '@/composables/useAppLoading';
import store from '@/composables/useVuex';
import { Network } from '@capacitor/network';
import { useOfflineManager } from '@/composables/useOfflineManager';
import storage from '@/services/storage.service';
import {
  restoreAwaitingLogoutAfterSync,
  tryPromptLogoutAfterOfflineSync,
} from '@/composables/useLogoutPrompt';
import { startShiftEndWarningWatcher } from '@/composables/useShiftEndWarning';
import { useI18n } from 'vue-i18n';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// Import APIs
import AreaBU from '@/api/AreaBU';
import ReportNoteCategory from '@/api/ReportNoteCategory';
import PatrolShiftView from '@/api/PatrolShiftView';
import CheckPointScanQr from './api/CheckPointScanQr';

const { syncData, loadPendingItems, pendingItems } = useOfflineManager();
const { loadingMessage } = useAppLoading();
const { initDatabase } = useSQLite();
const isAppReady = ref(false);

const getDynamicAreaIds = (userAreaId: number) => {
  const areaMapping: Record<number, number[]> = {
    1: [1, 2],
    3: [3]
  };
  return areaMapping[userAreaId] || [userAreaId];
};

// --- CHỐT CHẶN BẰNG WINDOW ĐỂ CHỐNG RE-MOUNT ---
const getGlobalApiList = (userData: any) => {
  if (!userData) {
    return {};
  }

  const checkpointPayload = {
    areaIds: getDynamicAreaIds(userData.userAreaId),
    roleIdStr: String(userData.userRoleId)
  };

  return {
    checkpoints: () => CheckPointScanQr.postCheckPointView(checkpointPayload),
    // checkpoints_id: () => PointReport.postPointReportView(),
    // area_bu: () => AreaBU.postAreaBU({ areaId: userData.userAreaId }),

    list_route: () => PatrolShiftView.postPatrolShiftView({
      getOfflineData: true,
      areaId: userData.userAreaId,
    }),

    report_note_category: () => ReportNoteCategory.postReportNoteCategory(),
  };
};

// Hàm đồng bộ an toàn dùng chung
let isSafeSyncing = false;

const safeSync = async (isInitApp = false) => {
  if (!store.state.token || !store.state.isOnline) return;
  if (isSafeSyncing) return;

  // Đọc xem trong máy có báo cáo Offline nào đang kẹt không?
  await loadPendingItems();
  const deleteQueue = (await storage.get('offline_delete_queue')) || [];
  const wrongScanQueue = (await storage.get('offline_wrong_scan_queue')) || [];
  const hasOfflineData = pendingItems.value.length > 0 || deleteQueue.length > 0 || wrongScanQueue.length > 0;

  const rawUser: any = store.state.dataUser;
  const userData = rawUser?.data ? rawUser.data : (rawUser || {});

  const lightListRouteApi = () => ({
    list_route: () => PatrolShiftView.postPatrolShiftView({
      getOfflineData: true,
      areaId: userData.userAreaId,
    }),
  });

  // Reconnect không có queue kẹt: vẫn refresh list_route (ca mới theo ngày/giờ)
  if (!isInitApp && !hasOfflineData) {
    isSafeSyncing = true;
    try {
      await store.dispatch('syncAllData', { apiList: lightListRouteApi(), mode: 'silent' });
    } catch (e) {
      console.error('Lỗi refresh list_route khi reconnect:', e);
    } finally {
      isSafeSyncing = false;
    }
    // Queue đã sạch (kể cả sau reload) → hỏi logout nếu đang awaiting
    void tryPromptLogoutAfterOfflineSync({ speakSuccess: true });
    return;
  }

  isSafeSyncing = true;

  try {
    // Nếu là F5 hoặc Login -> Ép bật Overlay chặn màn hình
    const mode = isInitApp ? 'overlay' : 'silent';

    if (mode === 'overlay') {
      store.commit('SET_SYNC_STATUS', {
        progress: 0,
        message: 'Đang chuẩn bị dữ liệu ca trực...', // Đổi câu chữ cho hợp lý lúc F5
        isSyncing: true,
        mode: 'overlay'
      });
    }

    // Tắt sync offline
    // 1. Đẩy queue offline lên trước
    if (hasOfflineData) {
      await syncData();
    }
    //

    // 2. Kiểm tra lại queue — chỉ download khi sạch (tránh đè tiến độ local chưa sync)
    await loadPendingItems();
    const deleteAfter = (await storage.get('offline_delete_queue')) || [];
    const wrongAfter = (await storage.get('offline_wrong_scan_queue')) || [];
    const queuesClean =
      pendingItems.value.length === 0 &&
      deleteAfter.length === 0 &&
      wrongAfter.length === 0;

    if (isInitApp) {
      // Login/F5: luôn cần master data; list_route đã merge+persist đúng trong syncAllData
      const apiList = getGlobalApiList(store.state.dataUser);
      await store.dispatch('syncAllData', { apiList, mode: mode });
    } else if (queuesClean) {
      await store.dispatch('syncAllData', { apiList: lightListRouteApi(), mode: 'silent' });
    }

    // 3. Một chỗ duy nhất hỏi logout (sau overlay download / upload)
    void tryPromptLogoutAfterOfflineSync({
      speakSuccess: hasOfflineData && queuesClean,
    });
  } catch (e) {
    console.error("Lỗi đồng bộ:", e);
    store.commit('SET_SYNC_STATUS', { progress: 0, message: '', isSyncing: false, mode: 'silent' });
  } finally {
    isSafeSyncing = false;
  }
};

const { locale } = useI18n();

const syncMessage = computed(
  () => store.state.syncMessage || 'Đang đồng bộ dữ liệu...'
);
const syncProgressLabel = computed(() => `${store.state.syncProgress}%`);

onMounted(async () => {
  // Global: cảnh báo 10 phút cuối trước psHourTo — mọi màn hình khi còn ca unfinished
  if (!(window as any).HAS_SHIFT_END_WARNING) {
    startShiftEndWarningWatcher();
    (window as any).HAS_SHIFT_END_WARNING = true;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      // Style.Light có nghĩa là "Nền sáng" -> Hệ điều hành sẽ tự đổi chữ/icon thành MÀU ĐEN
      await StatusBar.setStyle({ style: Style.Light });

      // (Tùy chọn) Ép luôn nền của thanh trạng thái thành màu trắng cho đồng bộ (Thường dùng cho Android)
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: '#ffffff' });
      }
    } catch (error) {
      console.warn('Không thể can thiệp thanh trạng thái:', error);
    }
  }

  // 1. Kiểm tra khóa ngay lập tức
  if ((window as any).APP_INITIALIZING || (window as any).APP_READY_LOCK) {
    isAppReady.value = true;
    return;
  }

  // 2. Gán khóa "ĐANG KHỞI TẠO" ngay lập tức (Không await)
  (window as any).APP_INITIALIZING = true;

  try {
    // Luồng khởi tạo chính
    await initDatabase();

    const savedLang = await storage.get('app_language');
    if (savedLang) {
      locale.value = savedLang;
    }

    await Promise.all([
      store.dispatch('restoreToken'),
      store.dispatch('restoreUser')
    ]);

    const status = await Network.getStatus();
    store.commit('SET_NETWORK_STATUS', status.connected);

    if (store.state.token) {
      await store.dispatch('initApp');
      await restoreAwaitingLogoutAfterSync();
      // Tắt sync offline
      if (status.connected) {
        safeSync(true);
      }
      //
    }

    // 3. Đăng ký Listener và khóa nó lại
    if (!(window as any).HAS_NETWORK_LISTENER) {
      await Network.removeAllListeners();
      Network.addListener('networkStatusChange', (status) => {
        const wasOffline = store.state.isOnline === false;
        const isNowOnline = status.connected === true;
        store.commit('SET_NETWORK_STATUS', status.connected);
        // Tắt sync offline
        if (wasOffline && isNowOnline) {
          // LÚC MẠNG CHẬP CHỜN CÓ LẠI -> TRUYỀN FALSE
          setTimeout(() => safeSync(false), 1500);
        }
        //
      });
      (window as any).HAS_NETWORK_LISTENER = true;
    }

    // 4. Hoàn tất toàn bộ khóa
    (window as any).APP_READY_LOCK = true;

  } catch (error) {
    console.error("Lỗi khởi động:", error);
    // Nếu lỗi, cho phép thử lại ở lần sau
    (window as any).APP_INITIALIZING = false;
  } finally {
    isAppReady.value = true;
  }
});
</script>

<style scoped>
.app-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.app-root > :deep(.nav-page),
.app-root > :deep(.login-page) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f4f4f4;
}

/* --- OVERLAY LOADING TOÀN APP --- */
.app-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100000 !important;
  cursor: wait;
}

.app-loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  min-width: 150px;
  max-width: min(88vw, 22rem);
  padding: 24px 20px;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
}

.app-loading-message {
  margin: 0;
  text-align: center;
  font-size: 0.95rem;
  font-weight: 500;
  color: #334155;
  line-height: 1.45;
}

/* --- OVERLAY ĐỒNG BỘ: MÀU TRẮNG ĐỤC + BLUR --- */
.sync-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;

  /* Tăng độ đục lên 0.85. Lỡ Android lỗi Blur thì vẫn ra màu trắng mờ, không bị đen màn */
  background-color: rgba(255, 255, 255, 0.2);

  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999 !important;
  cursor: not-allowed;
}

.sync-box {
  width: 80%;
  max-width: 320px;
  background-color: #ffffff;
  padding: 24px 20px;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.sync-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 0.875rem;
}

.sync-label {
  font-weight: 500;
  color: #334155;
  line-height: 1.4;
  text-align: left;
}

.sync-percent {
  flex-shrink: 0;
  font-weight: 600;
  color: #64748b;
}

.sync-box :deep(.sync-progress-root) {
  height: 7px !important;
  border-radius: 9999px !important;
  background: #e2e8f0 !important;
  overflow: hidden;
}

.sync-box :deep(.sync-progress-value) {
  background: #2563eb !important;
  border-radius: 9999px !important;
}

:global(.app-toast) {
  top: 38px !important;
  width: min(92vw, 22rem) !important;
  max-width: min(92vw, 22rem) !important;
}

:global(.app-toast .p-toast-message) {
  width: 100% !important;
  max-width: 100% !important;
}
</style>