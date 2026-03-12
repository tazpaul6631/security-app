<template>
  <ion-page id="main-content">
    <div class="ion-page" id="main-app-content">
      <ion-header class="nav-header">
        <ion-toolbar>
          <ion-button fill="clear" @click="goBackAndClearHistory" color="medium" slot="start">
            <strong>
              Internal
              <ion-text color="danger" style="margin-left: 1px;">Patrol</ion-text>
            </strong>
          </ion-button>

          <div slot="end" style="display: flex; align-items: center;">

            <div v-show="isSyncing" class="sync-container pulse-animation">
              <ion-spinner name="crescent" color="primary" class="small-spinner"></ion-spinner>
              <ion-text color="primary" class="sync-text">
                ({{ pendingItems.length }})
              </ion-text>
            </div>

            <ion-badge :class="isOnline ? 'status-online' : 'status-offline'" class="ion-margin-horizontal">
              {{ isOnline ? 'Online' : 'Offline' }}
            </ion-badge>

            <ion-icon class="ion-margin-end button_logout" :icon="exitOutline" @click="handleLogout"></ion-icon>
          </div>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <ion-router-outlet></ion-router-outlet>
      </ion-content>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton, IonContent, IonHeader, IonPage, IonToolbar, IonRouterOutlet,
  IonIcon, alertController, IonBadge, useIonRouter, IonText, IonSpinner
} from '@ionic/vue';
import { computed } from 'vue';
import { exitOutline } from 'ionicons/icons';
import router from '@/router';
import { useStore } from 'vuex';
import storageService from '@/services/storage.service';
import { useSQLite } from '@/composables/useSQLite';
import { useOfflineManager } from '@/composables/useOfflineManager';

const { logout } = useSQLite();
const store = useStore();

///////////////////////////////
// Khởi tạo router riêng của Ionic
const ionRouter = useIonRouter();
const isRouteUnfinished = computed(() => {
  const routes = store.state.dataListRoute || [];
  const selectedId = store.state.routeId;
  if (!selectedId) return false; // Không có lộ trình thì không chặn

  const currentRoute = routes.find((r: any) => r.routeId == selectedId);
  if (!currentRoute) return false;

  // Trả về true nếu còn ít nhất 1 điểm chưa xong (status != 1)
  return currentRoute.routeDetails.some((p: any) => p.status !== 1);
});

const goBackAndClearHistory = async () => {
  if (isRouteUnfinished.value) {
    const alert = await alertController.create({
      header: 'Cảnh báo',
      message: 'Lộ trình tuần tra chưa hoàn thành. Bạn không thể quay về trang chủ lúc này!',
      buttons: ['Đã hiểu']
    });
    await alert.present();
    return;
  }
  ionRouter.navigate('/home', 'root', 'replace');
};
//////////////////////////////

//////////////////////////////////////////
const { pendingItems, loadPendingItems, isSyncing, isOnline } = useOfflineManager();

const handleLogout = async () => {
  console.log('Bắt đầu kiểm tra trước khi đăng xuất...');

  if (isRouteUnfinished.value) {
    const alert = await alertController.create({
      header: 'Không thể đăng xuất',
      message: 'Bạn đang trong vòng tuần tra chưa hoàn thành. Vui lòng kết thúc lộ trình trước khi đăng xuất!',
      buttons: ['Đã hiểu']
    });
    await alert.present();
    return;
  }

  // 1. CHẶN ĐĂNG XUẤT: Kiểm tra xem còn báo cáo nào đang kẹt ở máy không
  await loadPendingItems(); // Lấy danh sách mới nhất từ Storage

  if (pendingItems.value.length > 0) {
    // Nếu mảng > 0, ném ra câu cảnh báo và kết thúc hàm ngay lập tức
    const alert = await alertController.create({
      header: 'Cảnh báo mất dữ liệu!',
      message: `Bạn đang có ${pendingItems.value.length} báo cáo chưa được đồng bộ lên máy chủ. Vui lòng kết nối mạng và đồng bộ dữ liệu trước khi đăng xuất để tránh mất công sức!`,
      buttons: [
        {
          text: 'Đã hiểu',
          role: 'cancel',
        }
      ]
    });
    await alert.present();
    return; // Dừng lại, KHÔNG chạy xuống các lệnh xóa bên dưới
  }

  // Nếu qua được ải kiểm tra, tiến hành đăng xuất bình thường
  console.log('Hàng chờ trống, tiến hành đăng xuất an toàn...');

  // 2. Dọn dẹp bộ nhớ RAM (Vuex)
  store.commit('CLEAR_ALL_DATA');

  // 3. Gọi hàm logout an toàn từ SQLite (chỉ xóa user hiện tại, giữ lại danh bạ offline)
  await logout();

  // 4. Xóa token riêng rẽ nếu cần (phòng hờ)
  if (storageService.remove) {
    await storageService.remove('user_token');
  }

  // 5. Chuyển hướng về trang Login mượt mà thay vì dùng window.location.reload()
  router.replace('/login');
};
////////////////////////////////////////////
</script>

<style>
/* CSS giữ nguyên theo thiết kế của bạn */
:root {
  --ion-color-rose: #d4fcc7;
  --ion-color-rose-rgb: 212, 252, 199;
  --ion-color-rose-contrast: #000000;
  --ion-color-rose-contrast-rgb: 0, 0, 0;
  --ion-color-rose-shade: #bbdeaf;
  --ion-color-rose-tint: #d8fcd0;
}

.ion-color-rose {
  --ion-color-base: var(--ion-color-rose);
  --ion-color-base-rgb: var(--ion-color-rose-rgb);
  --ion-color-contrast: var(--ion-color-rose-contrast);
  --ion-color-contrast-rgb: var(--ion-color-rose-contrast-rgb);
  --ion-color-shade: var(--ion-color-rose-shade);
  --ion-color-tint: var(--ion-color-rose-tint);
}

div[slot='content'] {
  background: rgba(var(--ion-color-rose-rgb), 0.25);
}

.icon-footer {
  display: flex;
  justify-content: center;
  align-items: center;
}

.button_logout {
  font-size: 25px;
}

.sync-container {
  display: flex;
  align-items: center;
  margin-right: 12px;
  padding: 4px 8px;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  border-radius: 16px;
}

.small-spinner {
  width: 16px;
  height: 16px;
  margin-right: 6px;
}

.sync-text {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

/* Hiệu ứng nhấp nháy nhẹ nhàng */
.pulse-animation {
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0% {
    transform: scale(0.98);
    opacity: 0.8;
  }

  50% {
    transform: scale(1.02);
    opacity: 1;
  }

  100% {
    transform: scale(0.98);
    opacity: 0.8;
  }
}

.sync-container {
  display: flex;
  align-items: center;
  margin-right: 8px;
  padding: 4px 8px;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  border-radius: 16px;
  /* Thêm dòng này */
  will-change: transform, opacity;
  min-width: 60px;
  /* Đảm bảo chiều rộng không nhảy khi hiện/ẩn */
  justify-content: center;
}

.pulse-animation {
  /* Chỉnh lại scale nhỏ thôi để tránh cảm giác bị giật mắt */
  animation: pulse-red 2s infinite ease-in-out;
}

@keyframes pulse-red {
  0% {
    transform: scale(1);
    opacity: 0.7;
  }

  50% {
    transform: scale(1.05);
    opacity: 1;
  }

  100% {
    transform: scale(1);
    opacity: 0.7;
  }
}

.status-online {
  background: #d4fcc7;
  color: #3c9441;
}

.status-offline {
  background: #ffdada;
  color: #7a1b1b;
}

.ion-margin-horizontal {
  width: fit-content;
  border-radius: 10px;
}
</style>