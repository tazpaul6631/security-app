<template>
  <ion-page id="main-content">
    <div class="ion-page" id="main-app-content">
      <ion-header class="nav-header">
        <ion-toolbar>

          <ion-buttons slot="start">
            <ion-button fill="clear" @click="goBackAndClearHistory">
              <img class="logo-company" src="/assets/icon.png" alt="logo-company"></img>
              <strong style="color: darkgray;">
                Internal
                <ion-text color="danger" style="margin-left: 1px;">Patrol</ion-text>
              </strong>
            </ion-button>
          </ion-buttons>

          <ion-buttons slot="end" style="display: flex; align-items: center;">
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
import { useI18n } from 'vue-i18n';
import { exitOutline } from 'ionicons/icons';
import router from '@/router';
import { useStore } from 'vuex';
import { useOfflineManager } from '@/composables/useOfflineManager';
import storageService from '@/services/storage.service';

const store = useStore();
const { t } = useI18n();

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
      header: t('messages.nav.warning'),
      message: t('messages.nav.incomplete-route'),
      buttons: [t('messages.nav.got')]
    });
    await alert.present();
    return;
  }
  ionRouter.navigate('/home', 'root', 'replace');
};
//////////////////////////////

//////////////////////////////////////////
const { pendingItems, loadPendingItems, isOnline } = useOfflineManager();

const handleLogout = async () => {
  try {
    console.log('Bắt đầu kiểm tra trước khi đăng xuất...');

    // 1. Chặn nếu chưa hoàn thành lộ trình
    if (isRouteUnfinished.value) {
      const alert = await alertController.create({
        header: t('messages.nav.unable-to-logout'),
        message: t('messages.nav.incomplete-patrol'),
        buttons: [t('messages.nav.got')]
      });
      await alert.present();
      return;
    }

    // 2. GOM TOÀN BỘ 3 HÀNG CHỜ ĐỂ KIỂM TRA
    await loadPendingItems();
    const deleteQueue = (await storageService.get('offline_delete_queue')) || [];
    const wrongScanQueue = (await storageService.get('offline_wrong_scan_queue')) || [];

    const totalUnsynced = pendingItems.value.length + deleteQueue.length + wrongScanQueue.length;

    // Nếu có bất kỳ data nào kẹt lại -> Hiện cảnh báo và CHẶN đăng xuất
    if (totalUnsynced > 0) {
      const alert = await alertController.create({
        header: t('messages.nav.data-loss'),
        message: `Hệ thống đang có ${totalUnsynced} tiến trình chờ đồng bộ do mạng yếu. Đăng xuất lúc này sẽ gây mất dữ liệu. Vui lòng chờ mạng ổn định!`,
        buttons: [{ text: t('messages.nav.got'), role: 'cancel' }]
      });
      await alert.present();
      return;
    }

    // --- BẮT ĐẦU QUY TRÌNH DỌN DẸP TRIỆT ĐỂ ---
    console.log('Tiến hành dọn dẹp và đăng xuất...');
    await store.dispatch('logout');
    router.replace('/login');

  } catch (error) {
    console.error("Lỗi câm (Silent Error) khi đăng xuất:", error);

    // 3. CHỐT CHẶN CUỐI CÙNG: Nếu SQLite bị khóa hoặc code gãy, VẪN HIỆN ALERT
    const alert = await alertController.create({
      header: 'Lỗi hệ thống',
      message: 'Đang xử lý đồng bộ ngầm, hệ thống tạm thời bận. Vui lòng đợi vài giây và thử lại!',
      buttons: ['OK']
    });
    await alert.present();
  }
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
  margin: 0 !important;
  padding: 5px;
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