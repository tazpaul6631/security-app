<template>
  <ion-app>
    <div v-if="store.state.isSyncing" class="sync-overlay">
      <div class="sync-box">
        <ion-text color="primary">
          <h3>{{ store.state.syncMessage || 'Đang đồng bộ dữ liệu...' }}</h3>
        </ion-text>
        <ion-progress-bar :value="store.state.syncProgress / 100" color="success"></ion-progress-bar>
        <p>{{ store.state.syncProgress }}%</p>
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
import { IonApp, IonRouterOutlet, IonSpinner, IonProgressBar, IonText } from '@ionic/vue';
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
      mode: 'overlay' // Đổi mode về overlay cho thống nhất
    });

    // 2. Chạy hàm đẩy báo cáo Offline lên Server
    await syncData();

    // 3. Quá trình kéo dữ liệu mới từ Server về máy
    const apiList = getGlobalApiList(store.state.dataUser);
    await store.dispatch('syncAllData', { apiList, mode: 'overlay' });

  } catch (e) {
    console.error("Lỗi đồng bộ ngầm:", e);
    // Nếu lỗi giữa chừng, đảm bảo tắt màn chắn
    store.commit('SET_SYNC_STATUS', { progress: 0, message: '', isSyncing: false, mode: 'overlay' });
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
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f4f4f4;
}

/* --- STYLE DÀNH CHO MODAL ĐỒNG BỘ MỚI (KIỂU POPUP NHỎ CŨ) --- */
.sync-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.3);
  /* Nền ngoài tối mờ nhẹ */
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
  /* Bảng trắng nổi lên */
  padding: 24px 20px;
  border-radius: 16px;
  /* Bo góc mềm mại */
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  /* Đổ bóng 3D */
  text-align: center;
}

.sync-box h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
  /* Chữ nhỏ vừa vặn */
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