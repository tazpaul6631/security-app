<template>
  <ion-app>
    <div v-if="store.state.isSyncing" class="sync-overlay">
      <div class="sync-box">
        <ion-spinner name="bubbles" color="primary" style="transform: scale(1.5); margin-bottom: 16px;"></ion-spinner>
        <ion-text color="primary">
          <h3>{{ store.state.syncMessage || 'Đang đồng bộ dữ liệu...' }}</h3>
        </ion-text>
        <ion-progress-bar :value="store.state.syncProgress / 100" color="success"></ion-progress-bar>
        <p>{{ store.state.syncProgress }}%</p>
      </div>
    </div>

    <ion-router-outlet v-if="isAppReady" />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonSpinner, IonProgressBar, IonText } from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { useSQLite } from '@/composables/useSQLite';
import store from '@/composables/useVuex';
import { Network } from '@capacitor/network';
import { useOfflineManager } from '@/composables/useOfflineManager';
import storage from '@/services/storage.service';
import { useI18n } from 'vue-i18n';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// Import APIs
import PointReport from '@/api/PointReport';
import AreaBU from '@/api/AreaBU';
import ReportNoteCategory from '@/api/ReportNoteCategory';
import PatrolShiftView from '@/api/PatrolShiftView';
import CheckPointScanQr from './api/CheckPointScanQr';

const { syncData, loadPendingItems, pendingItems } = useOfflineManager();
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
    console.warn("Chưa có userData khi gọi getGlobalApiList");
    return {};
  }

  const checkpointPayload = {
    areaIds: getDynamicAreaIds(userData.userAreaId),
    roleIdStr: String(userData.userRoleId)
  };

  return {
    checkpoints: () => CheckPointScanQr.postCheckPointView(checkpointPayload),
    // checkpoints_id: () => PointReport.postPointReportView(),
    area_bu: () => AreaBU.postAreaBU({ areaId: userData.userAreaId }),

    list_route: () => {
      const lockedPsId = store.state.psId;
      const now = new Date();

      // Tự động build lại ngày tháng hiện tại, ghi đè lên userData cũ
      const payload = {
        ...userData,
        psDay: now.getDate(),
        psMonth: now.getMonth() + 1,
        psYear: now.getFullYear()
      };

      console.log(payload);

      if (lockedPsId) {
        return PatrolShiftView.postPatrolShiftView({ ...payload, psId: lockedPsId });
      }
      return PatrolShiftView.postPatrolShiftView(payload);
    },

    report_note_category: () => ReportNoteCategory.getReportNoteCategory(),
    base_point_report: () => PointReport.postBasePointReportView(0),
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
  const hasOfflineData = pendingItems.value.length > 0 || deleteQueue.length > 0 || wrongScanQueue.length > 0;;

  // LƯỚI LỌC LOGIC THÔNG MINH Ở ĐÂY:
  // Nếu chỉ là có mạng lại (không phải F5) VÀ không có data offline -> THOÁT LUÔN!
  if (!isInitApp && !hasOfflineData) {
    console.log("Mạng khôi phục nhưng không có báo cáo kẹt. Bỏ qua đồng bộ.");
    return;
  }

  isSafeSyncing = true;
  console.log("Luồng đồng bộ an toàn đang chạy...");

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

    // 1. Chỉ chạy hàm đẩy ảnh offline lên nếu thực sự CÓ data
    if (hasOfflineData) {
      await syncData();
    }

    // 2. Nếu là F5/Login (isInitApp = true), TẢI MỚI TOÀN BỘ MASTER DATA
    // Nếu là ngầm (có mạng lại), BỎ QUA việc tải Master Data để đỡ nặng máy, hoặc chỉ tải lại list_route.
    if (isInitApp) {
      const apiList = getGlobalApiList(store.state.dataUser);
      await store.dispatch('syncAllData', { apiList, mode: mode });
    } else {
      // (Tùy chọn) Nếu mạng phục hồi, bạn chỉ cần cập nhật lại list_route xem có ca trực mới không, 
      // không cần tải lại hàng ngàn Checkpoint làm gì cho cực CPU.
      const rawUser: any = store.state.dataUser;
      const userData = rawUser?.data ? rawUser.data : (rawUser || {});

      const lightApiList = {
        list_route: () => {
          const lockedPsId = store.state.psId;
          const now = new Date();

          const payload = {
            ...userData,
            psDay: now.getDate(),
            psMonth: now.getMonth() + 1,
            psYear: now.getFullYear()
          };

          if (lockedPsId) {
            return PatrolShiftView.postPatrolShiftView({ ...payload, psId: lockedPsId });
          }
          return PatrolShiftView.postPatrolShiftView(payload);
        }
      };
      await store.dispatch('syncAllData', { apiList: lightApiList, mode: 'silent' });
    }
  } catch (e) {
    console.error("Lỗi đồng bộ:", e);
    store.commit('SET_SYNC_STATUS', { progress: 0, message: '', isSyncing: false, mode: 'silent' });
  } finally {
    isSafeSyncing = false;
  }
};

const { locale } = useI18n();

onMounted(async () => {
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
    console.log("Hệ thống đang khởi tạo hoặc đã sẵn sàng. Chặn luồng trùng lặp.");
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
      if (status.connected) {
        safeSync(true);
      }
    }

    // 3. Đăng ký Listener và khóa nó lại
    if (!(window as any).HAS_NETWORK_LISTENER) {
      await Network.removeAllListeners();
      Network.addListener('networkStatusChange', (status) => {
        const wasOffline = store.state.isOnline === false;
        const isNowOnline = status.connected === true;
        store.commit('SET_NETWORK_STATUS', status.connected);
        if (wasOffline && isNowOnline) {
          // LÚC MẠNG CHẬP CHỜN CÓ LẠI -> TRUYỀN FALSE
          setTimeout(() => safeSync(false), 1500);
        }
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
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f4f4f4;
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
  /* Nền trắng đặc cho box */
  padding: 24px 20px;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  /* Bóng đổ mềm */
  text-align: center;
}

.sync-box h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.sync-box p {
  margin-top: 12px;
  margin-bottom: 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}
</style>