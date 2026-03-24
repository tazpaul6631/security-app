<template>
  <ion-page id="main-content">
    <div class="ion-page" id="main-app-content">
      <ion-header class="nav-header">
        <ion-toolbar>

          <ion-buttons slot="start">
            <ion-button fill="clear" @click="goBackAndClearHistory" color="medium">
              <img class="logo-company" src="/assets/icon.png" alt="logo-company"></img>
              <strong>
                Internal
                <ion-text color="danger" style="margin-left: 1px;">Patrol</ion-text>
              </strong>
            </ion-button>
          </ion-buttons>

          <ion-buttons slot="end" style="display: flex; align-items: center;">

            <div :style="{ visibility: isSyncing ? 'visible' : 'hidden' }" class="sync-container pulse-animation">
              <ion-spinner name="crescent" color="primary" class="small-spinner"></ion-spinner>
              <ion-text color="primary" class="sync-text">
                ({{ pendingItems.length }})
              </ion-text>
            </div>

            <ion-badge :class="isOnline ? 'status-online' : 'status-offline'" class="ion-margin-horizontal">
              {{ isOnline ? $t('layout.online') : $t('layout.offline') }}
            </ion-badge>

            <ion-button @click="handleLogout" color="dark">
              <ion-icon class="button_logout" :icon="exitOutline"></ion-icon>
            </ion-button>

          </ion-buttons>

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
  IonIcon, alertController, IonBadge, useIonRouter, IonText, IonSpinner, IonButtons
} from '@ionic/vue';
import { computed } from 'vue';
import { exitOutline } from 'ionicons/icons';
import router from '@/router';
import { useStore } from 'vuex';
import { useOfflineManager } from '@/composables/useOfflineManager';

const store = useStore();

///////////////////////////////
// Khởi tạo router riêng của Ionic
const ionRouter = useIonRouter();
const isRouteUnfinished = computed(() => {
  const lockedId = store.state.unfinishedRouteId;
  return !!lockedId;
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

  // 1. Chặn nếu chưa hoàn thành lộ trình
  if (isRouteUnfinished.value) {
    const alert = await alertController.create({
      header: 'Không thể đăng xuất',
      message: 'Bạn đang trong vòng tuần tra chưa hoàn thành. Vui lòng kết thúc lộ trình trước khi đăng xuất!',
      buttons: ['Đã hiểu']
    });
    await alert.present();
    return;
  }

  // 2. Chặn nếu còn báo cáo chưa đồng bộ (Tránh mất dữ liệu)
  await loadPendingItems();
  if (pendingItems.value.length > 0) {
    const alert = await alertController.create({
      header: 'Cảnh báo mất dữ liệu!',
      message: `Bạn đang có ${pendingItems.value.length} báo cáo chưa được đồng bộ. Vui lòng kết nối mạng để đồng bộ trước khi đăng xuất!`,
      buttons: [{ text: 'Đã hiểu', role: 'cancel' }]
    });
    await alert.present();
    return;
  }

  // --- BẮT ĐẦU QUY TRÌNH DỌN DẸP TRIỆT ĐỂ ---
  console.log('Tiến hành dọn dẹp và đăng xuất...');

  await store.dispatch('logout');

  // 5. Chuyển hướng
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

.logo-company {
  width: fit-content;
  max-height: 17px;
  object-fit: contain;
  margin-right: 4px;
}


/* 1. NGĂN RỚT DÒNG CỤM LOGO & TITLE BÊN TRÁI */
.nav-header ion-button strong {
  white-space: nowrap;
  text-overflow: ellipsis;
  /* Nếu màn hình quá nhỏ sẽ hiển thị "Internal..." thay vì tràn ra ngoài */
}

/* 2. ÉP CỤM BÊN PHẢI NẰM TRÊN 1 HÀNG NGANG */
.nav-header ion-buttons[slot="end"] {
  flex-wrap: nowrap;
  /* Cấm bẻ dòng */
}

/* 3. NGĂN CÁC PHẦN TỬ BỊ BÓP MÉO KHI MÀN HÌNH NHỎ */
.sync-container {
  white-space: nowrap;
  flex-shrink: 0;
  /* Giữ nguyên kích thước, không bị ép nhỏ lại */
  margin-right: 8px;
  /* Chỉnh lại margin cho vừa vặn */
}

.status-online,
.status-offline {
  white-space: nowrap;
  flex-shrink: 0;
  /* Không cho badge bị ép lún chữ */
}

/* 4. TỐI ƯU KHOẢNG CÁCH NÚT LOGOUT CHO MÀN HÌNH NHỎ */
.nav-header ion-buttons[slot="end"] ion-button {
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
  /* Cắt giảm margin thừa mặc định của Ionic */
}
</style>