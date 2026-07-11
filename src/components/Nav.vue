<template>
  <ion-page id="main-content">
    <div class="ion-page" id="main-app-content">
      <header class="nav-topbar">
        <button type="button" class="nav-brand-btn" :aria-label="'Internal Patrol'" @click="goBackAndClearHistory">
          <span class="nav-brand-logo" aria-hidden="true">
            <img class="logo-company" src="/assets/icon.png" alt="" />
          </span>
          <span class="nav-brand-title">
            <span class="brand-title-part">Internal</span>
            <span class="accent">Patrol</span>
          </span>
        </button>

        <div class="nav-actions">
          <Tag :value="isOnline ? $t('layout.online') : $t('layout.offline')"
            :class="isOnline ? 'status-online' : 'status-offline'" class="status-tag" />
          <Button icon="pi pi-sign-out" severity="secondary" variant="text" rounded class="logout-btn"
            :aria-label="$t('layout.logout')" size="large" @click="isLogoutModalOpen = true" />
        </div>
      </header>

      <Dialog v-model:visible="isLogoutModalOpen" modal :header="t('layout.logout_confirm_title')" class="logout-dialog"
        :style="{ width: 'min(92vw, 22rem)' }" :draggable="false" :close-on-escape="!isLoggingOut" :closable="false"
        :dismissable-mask="!isLoggingOut" @after-hide="onLogoutModalAfterHide">
        <p class="logout-dialog-message">{{ t('layout.logout_confirm_message') }}</p>
        <template #footer>
          <Button :label="t('layout.cancel')" severity="secondary" variant="outlined" :disabled="isLoggingOut"
            size="large" @click="isLogoutModalOpen = false" />
          <Button :label="t('layout.logout')" icon="pi pi-sign-out" severity="danger" :loading="isLoggingOut"
            size="large" @click="confirmLogout" />
        </template>
      </Dialog>

      <ion-content>
        <ion-router-outlet></ion-router-outlet>
      </ion-content>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonContent, IonPage, IonRouterOutlet,
  alertController, useIonRouter,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import router from '@/router';
import { useStore } from 'vuex';
import { useOfflineManager } from '@/composables/useOfflineManager';
import storageService from '@/services/storage.service';
import Logout from '@/api/Logout';
import { useRouteTimer } from '@/composables/useRouteTimer';
import { useToast } from 'primevue/usetoast';
import { Button, Dialog, Tag } from '@/plugins/primevue.components';

const toast = useToast();

const isLogoutModalOpen = ref(false);
const isLoggingOut = ref(false);
let resolveLogoutModalClosed: (() => void) | null = null;

const waitForLogoutModalClose = (): Promise<void> => {
  if (!isLogoutModalOpen.value) return Promise.resolve();

  return new Promise<void>((resolve) => {
    resolveLogoutModalClosed = resolve;
    isLogoutModalOpen.value = false;
  });
};

const onLogoutModalAfterHide = () => {
  resolveLogoutModalClosed?.();
  resolveLogoutModalClosed = null;
};

const { clearTimer } = useRouteTimer();
const store = useStore();
const { t } = useI18n();

///////////////////////////////
// Khởi tạo router riêng của Ionic
const ionRouter = useIonRouter();
const isRouteUnfinished = computed(() => store.getters.isRouteUnfinished);

const goBackAndClearHistory = async () => {
  if (isRouteUnfinished.value) {
    toast.add({
      severity: 'warn',
      summary: t('messages.nav.warning'),
      detail: t('messages.nav.incomplete-route'),
      life: 8000,
      closable: false,
    });
    return;
  }
  ionRouter.navigate('/home', 'root', 'replace');
};
//////////////////////////////

//////////////////////////////////////////
const { pendingItems, loadPendingItems, isOnline } = useOfflineManager();

const confirmLogout = async () => {
  isLoggingOut.value = true;
  try {
    await performLogout();
  } finally {
    if (isLogoutModalOpen.value) {
      isLoggingOut.value = false;
    }
  }
};

const performLogout = async () => {
  try {
    console.log('Bắt đầu kiểm tra trước khi đăng xuất...');

    // 1. Chặn nếu chưa hoàn thành lộ trình
    if (isRouteUnfinished.value) {
      isLogoutModalOpen.value = false;
      toast.add({
        severity: 'warn',
        summary: t('messages.nav.unable-to-logout'),
        detail: t('messages.nav.incomplete-patrol'),
        life: 8000,
        closable: false,
      });
      return;
    }

    // 2. GOM TOÀN BỘ 3 HÀNG CHỜ ĐỂ KIỂM TRA
    await loadPendingItems();
    const deleteQueue = (await storageService.get('offline_delete_queue')) || [];
    const wrongScanQueue = (await storageService.get('offline_wrong_scan_queue')) || [];

    const totalUnsynced = pendingItems.value.length + deleteQueue.length + wrongScanQueue.length;

    // Nếu có bất kỳ data nào kẹt lại -> Hiện cảnh báo và CHẶN đăng xuất
    if (totalUnsynced > 0) {
      isLogoutModalOpen.value = false;
      toast.add({
        severity: 'warn',
        summary: t('messages.nav.data-loss'),
        detail: t('messages.nav.msg-logout-sync-offline', { totalUnsynced }),
        life: 8000,
        closable: false,
      });
      return;
    }

    // 3. GỌI API LOGOUT LÊN BACKEND
    // Chỉ gọi khi có mạng và có thông tin user
    if (store.state.isOnline && store.state.dataUser?.userId) {
      try {
        console.log('Đang gọi API đăng xuất...');
        await Logout.postLogout({
          userId: store.state.dataUser.userId
        });
      } catch (apiError) {
        // Lỗi câm: Backend lỗi hoặc rớt mạng giữa chừng, nhưng VẪN CHO PHÉP XÓA LOCAL
        console.warn("API Logout thất bại, tiếp tục đăng xuất local:", apiError);
      }
    }

    // --- 4. BẮT ĐẦU QUY TRÌNH DỌN DẸP TRIỆT ĐỂ LOCAL ---
    console.log('Tiến hành dọn dẹp state và storage...');
    await clearTimer();
    await store.dispatch('logout');

    // 5. Đóng modal, đợi animation xong rồi mới chuyển trang
    await waitForLogoutModalClose();
    await router.replace('/login');

  } catch (error) {
    console.error("Lỗi hệ thống khi đăng xuất:", error);
    isLogoutModalOpen.value = false;

    // CHỐT CHẶN CUỐI CÙNG: Nếu SQLite bị khóa hoặc code gãy
    const alert = await alertController.create({
      header: 'Lỗi hệ thống',
      message: 'Hệ thống tạm thời bận. Vui lòng đợi vài giây và thử lại!',
      buttons: ['OK']
    });
    await alert.present();
  }
};
////////////////////////////////////////////
</script>

<style scoped>
.nav-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 56px;
  padding: calc(env(safe-area-inset-top, 0px) + 4px) 8px 4px 4px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.nav-brand-btn {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 7.5rem);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  margin: 0;
  padding: 4px 6px 4px 2px;
  min-height: 44px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  border-radius: 10px;
  text-align: left;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.nav-brand-btn:hover,
.nav-brand-btn:focus,
.nav-brand-btn:focus-visible,
.nav-brand-btn:active {
  background: transparent;
  outline: none;
  box-shadow: none;
}

.nav-brand-logo {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.logo-company {
  width: 20px;
  height: 20px;
  object-fit: contain;
  display: block;
}

.nav-brand-title {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  line-height: 1.2;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.brand-title-part {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #64748b;
}

.accent {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #dc2626;
}

.nav-topbar :deep(.p-button),
.logout-dialog :deep(.p-button) {
  -webkit-tap-highlight-color: transparent;
}

.logout-btn:hover,
.logout-btn:focus,
.logout-btn:active,
.logout-btn.p-focus,
.logout-btn.p-button:hover,
.logout-btn.p-button:focus,
.logout-btn.p-button:active,
.logout-btn.p-button.p-focus {
  background: transparent !important;
  border-color: transparent !important;
  color: #334155 !important;
  box-shadow: none !important;
}

.logout-dialog :deep(.p-button-outlined:not(:disabled):hover),
.logout-dialog :deep(.p-button-outlined:not(:disabled):focus),
.logout-dialog :deep(.p-button-outlined:not(:disabled):active),
.logout-dialog :deep(.p-button-outlined.p-focus) {
  background: transparent !important;
  box-shadow: none !important;
}

.logout-dialog :deep(.p-button-danger:not(:disabled):hover),
.logout-dialog :deep(.p-button-danger:not(:disabled):focus),
.logout-dialog :deep(.p-button-danger:not(:disabled):active),
.logout-dialog :deep(.p-button-danger.p-focus) {
  background: #dc2626 !important;
  border-color: #dc2626 !important;
  color: #ffffff !important;
  box-shadow: none !important;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.status-tag {
  white-space: nowrap;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.35rem 0.55rem;
}

.status-online {
  background: #d4fcc7 !important;
  color: #3c9441 !important;
}

.status-offline {
  background: #ffdada !important;
  color: #7a1b1b !important;
}

.logout-btn {
  width: 2.5rem;
  height: 2.5rem;
  color: #334155;
  -webkit-tap-highlight-color: transparent;
}

.logout-btn :deep(.p-button-icon) {
  font-size: 1.25rem;
}

.logout-dialog-message {
  margin: 0;
  color: #475569;
  font-size: 0.95rem;
  line-height: 1.5;
}

.logout-dialog :deep(.p-dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

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
</style>
