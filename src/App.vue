<template>
  <ion-app>
    <ion-progress-bar v-if="store.state.isSyncing && store.state.syncMode === 'silent'"
      :value="store.state.syncProgress / 100" color="success" class="silent-progress-bar">
    </ion-progress-bar>

    <div v-if="store.state.isSyncing" class="sync-blocker-overlay">
      <div class="sync-dialog">
        <ion-spinner name="crescent" color="primary"></ion-spinner>
        <p>{{ store.state.syncMessage || 'Đang đồng bộ dữ liệu...' }}</p>
      </div>
    </div>

    <div v-if="!isAppReady" class="app-loading">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Đang chuẩn bị dữ liệu an ninh...</p>
    </div>

    <ion-router-outlet v-else />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonSpinner, IonProgressBar } from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { useSQLite } from '@/composables/useSQLite';
import store from '@/composables/useVuex';
import { Network } from '@capacitor/network';
import { useOfflineManager } from '@/composables/useOfflineManager';

// Import APIs
import CheckPointScanQr from '@/api/CheckPointScanQr';
import PointReport from '@/api/PointReport';
import AreaBU from '@/api/AreaBU';
import ReportNoteCategory from '@/api/ReportNoteCategory';
import PatrolShiftView from '@/api/PatrolShiftView';

const { syncData } = useOfflineManager();
const { initDatabase } = useSQLite();
const isAppReady = ref(false);

// --- CHỐT CHẶN BẰNG WINDOW ĐỂ CHỐNG RE-MOUNT ---
const getGlobalApiList = (userData: any) => ({
  checkpoints: () => CheckPointScanQr.postCheckPointView(),
  checkpoints_id: () => PointReport.postPointReportView(),
  area_bu: () => AreaBU.postAreaBU({ areaId: userData.userAreaId }),

  list_route: () => {
    // Lấy khóa dở dang từ Store
    const lockedPsId = store.state.psId;

    // Nếu có khóa, gửi yêu cầu lấy đích danh ca trực đó
    if (lockedPsId) {
      return PatrolShiftView.postPatrolShiftView({
        ...userData,
        psId: lockedPsId
      });
    }

    // Nếu không có khóa (rảnh rỗi), lấy ca theo giờ hiện tại bình thường
    return PatrolShiftView.postPatrolShiftView(userData);
  },

  report_note_category: () => ReportNoteCategory.getReportNoteCategory(),
  base_point_report: () => PointReport.postBasePointReportView(0),
});

// Hàm đồng bộ an toàn dùng chung
const safeSync = async () => {
  if (!store.state.token || !store.state.isOnline) return;
  console.log("🚀 Luồng đồng bộ an toàn đang chạy...");
  try {
    // 1. BẬT MÀN CHẮN & HIỂN THỊ THÔNG BÁO NGAY LẬP TỨC
    store.commit('SET_SYNC_STATUS', {
      progress: 0,
      message: 'Đang tải dữ liệu offline lên server...',
      isSyncing: true,
      mode: 'silent'
    });

    // 2. Chạy hàm đẩy báo cáo Offline lên Server
    await syncData();

    // 3. Quá trình kéo dữ liệu mới từ Server về máy (Hàm này đã tự có logic cập nhật Message và Progress bên trong)
    const apiList = getGlobalApiList(store.state.dataUser);
    await store.dispatch('syncAllData', { apiList, mode: 'silent' });

    // (Lưu ý: Bạn không cần tắt màn chắn ở đây vì hàm syncAllData đã có sẵn logic setTimeout 1.5s để tắt nó ở cuối rồi)

  } catch (e) {
    console.error("Lỗi đồng bộ ngầm:", e);
    // Nếu lỗi giữa chừng, đảm bảo tắt màn chắn
    store.commit('SET_SYNC_STATUS', { progress: 0, message: '', isSyncing: false, mode: 'silent' });
  }
};

onMounted(async () => {
  // 1. Kiểm tra khóa ngay lập tức
  if ((window as any).APP_INITIALIZING || (window as any).APP_READY_LOCK) {
    console.log("⚠️ Hệ thống đang khởi tạo hoặc đã sẵn sàng. Chặn luồng trùng lặp.");
    isAppReady.value = true;
    return;
  }

  // 2. Gán khóa "ĐANG KHỞI TẠO" ngay lập tức (Không await)
  (window as any).APP_INITIALIZING = true;

  try {
    // Luồng khởi tạo chính
    await initDatabase();
    await Promise.all([
      store.dispatch('restoreToken'),
      store.dispatch('restoreUser')
    ]);

    const status = await Network.getStatus();
    store.commit('SET_NETWORK_STATUS', status.connected);

    if (store.state.token) {
      await store.dispatch('initApp');
      if (status.connected) {
        safeSync();
      }
    }

    // 3. Đăng ký Listener và khóa nó lại
    if (!(window as any).HAS_NETWORK_LISTENER) {
      await Network.removeAllListeners();
      Network.addListener('networkStatusChange', (status) => {
        // Sử dụng giá trị cũ từ store để so sánh
        const wasOffline = store.state.isOnline === false;
        const isNowOnline = status.connected === true;

        store.commit('SET_NETWORK_STATUS', status.connected);

        if (wasOffline && isNowOnline) {
          console.log("Mạng khôi phục: Kích hoạt đồng bộ ngầm.");
          setTimeout(() => safeSync(), 1500);
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
/* CSS giữ nguyên như cũ */
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f4f4f4;
}

.silent-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  z-index: 9999;
}

/* Màn chắn phủ kín toàn ứng dụng */
.sync-blocker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99999 !important;
  background-color: rgba(0, 0, 0, 0.2);
  /* Làm tối nền đi một chút để hộp thoại nổi bật hơn */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
}

/* Hộp thoại thông báo đồng bộ */
.sync-dialog {
  background-color: #ffffff;
  padding: 20px 30px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 200px;
}

.sync-dialog p {
  margin-top: 15px;
  margin-bottom: 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
  text-align: center;
}
</style>