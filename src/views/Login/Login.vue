<template>
  <ion-page>
    <div class="login-page">
      <div class="login-shell">
        <header class="login-topbar">
          <Select v-model="locale" :options="langOptions" option-label="short" option-value="value" class="lang-pill"
            panel-class="lang-select-panel" :aria-label="t('login.lang_select')" @update:model-value="onLangChange">
            <template #value="slotProps">
              <div v-if="slotProps.value" class="lang-value">
                <img :src="getLangFlag(slotProps.value)" :alt="getLangShort(slotProps.value)" class="lang-flag" />
                <span>{{ getLangShort(slotProps.value) }}</span>
              </div>
            </template>
            <template #option="slotProps">
              <div class="lang-option">
                <img :src="slotProps.option.flag" :alt="slotProps.option.label" class="lang-flag" />
                <span>{{ slotProps.option.label }}</span>
              </div>
            </template>
          </Select>
        </header>

        <section class="login-panel">
          <div class="brand-block">
            <div class="brand-block-inner" aria-hidden="true">
              <div class="brand-icon">
                <i class="pi pi-shield" />
              </div>
              <div class="brand-title-block">
                <h1 class="brand-title">
                  <span class="brand-title-part">Internal</span> <span class="accent">Patrol</span>
                </h1>
              </div>
            </div>
          </div>

          <form class="login-form" @submit.prevent="handleLogin">
            <div class="form-field">
              <label class="field-label" for="user-code">{{ t('login.username') }}</label>
              <div class="username-row">
                <IconField icon-position="left" class="username-input">
                  <InputIcon class="pi pi-user" />
                  <InputText id="user-code" v-model="loginDetail.userCode" :placeholder="t('login.scan_qr_hint')" />
                </IconField>
                <Button type="button" icon="pi pi-qrcode" severity="success" variant="outlined" class="scan-btn"
                  size="large" :aria-label="t('login.scan_qr')" @click="handleScanQRLogin" />
              </div>
            </div>

            <div class="form-field">
              <label class="field-label" for="user-password">{{ t('login.password') }}</label>
              <IconField icon-position="left" class="field-control">
                <InputIcon class="pi pi-lock" />
                <Password input-id="user-password" v-model="loginDetail.userPassword" :feedback="false" toggle-mask
                  :placeholder="t('login.password')" @keyup.enter="handleLogin" />
              </IconField>
            </div>

            <Message v-if="errorMessage" severity="error" :closable="false" icon="pi pi-exclamation-circle"
              class="error-message">
              {{ errorMessage }}
            </Message>

            <Button type="submit" severity="success" icon="pi pi-sign-in" class="submit-btn" fluid size="large"
              :disabled="isButtonDisabled || isLoading" :loading="isLoading" :label="t('login.btn_login')" />
          </form>
        </section>
      </div>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, useBackButton } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { reactive, ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import CryptoJS from 'crypto-js';
import { useI18n } from 'vue-i18n';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { App } from '@capacitor/app';
import { useOfflineManager } from '@/composables/useOfflineManager';

import {
  Button,
  IconField,
  InputIcon,
  InputText,
  Message,
  Password,
  Select,
} from '@/plugins/primevue.components';

import Login from '@/api/Login';
import storageService from '@/services/storage.service';
import CheckPointScanQr from '@/api/CheckPointScanQr';
import AreaBU from '@/api/AreaBU';
import ReportNoteCategory from '@/api/ReportNoteCategory';
import PatrolShiftView from '@/api/PatrolShiftView';

interface LangOption {
  label: string;
  short: string;
  value: string;
  flag: string;
}

const router = useRouter();
const store = useStore();
const { syncData, loadPendingItems, pendingItems } = useOfflineManager();
const errorMessage = ref('');
const isLoading = ref(false);

const loginDetail = reactive({
  userCode: '',
  userPassword: '',
});

const langOptions: LangOption[] = [
  { label: 'Tiếng Việt', short: 'VN', value: 'vi', flag: '/assets/flags/vi.png' },
  { label: 'English', short: 'EN', value: 'en', flag: '/assets/flags/en.png' },
  { label: '中文', short: '中文', value: 'zh', flag: '/assets/flags/zh.png' },
];

const isButtonDisabled = computed(() => {
  return !loginDetail.userCode.trim() || !loginDetail.userPassword.trim();
});

const getLangShort = (value: string) => {
  return langOptions.find((item) => item.value === value)?.short ?? value;
};

const getLangFlag = (value: string) => {
  return langOptions.find((item) => item.value === value)?.flag ?? '';
};

const hashPassword = (password: string) => {
  return CryptoJS.SHA256(password).toString();
};

const getDynamicAreaIds = (userAreaId: number) => {
  const areaMapping: Record<number, number[]> = {
    1: [1, 2],
    3: [3]
  };
  return areaMapping[userAreaId] || [userAreaId];
};

const handleLogin = async () => {
  if (isButtonDisabled.value) return;

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const isOnline = store.state.isOnline;

    if (isOnline) {
      const responseBU = await Login.postUserValidate(loginDetail);
      const result = responseBU.data;

      if (result?.success && result.data) {
        const userData = {
          ...result.data
        };

        store.commit('SET_DATAUSER', userData);
        store.commit('SET_TOKEN', userData.accessToken);
        await storageService.set('user_data', userData);
        await storageService.set('user_token', userData.accessToken);

        let offlineUsers = await storageService.get('offline_users_dict') || {};
        offlineUsers[loginDetail.userCode] = {
          profile: userData,
          hashedPassword: hashPassword(loginDetail.userPassword)
        };
        await storageService.set('offline_users_dict', offlineUsers);

        await store.dispatch('initApp');

        await loadPendingItems();
        const deleteQueue = (await storageService.get('offline_delete_queue')) || [];
        const wrongScanQueue = (await storageService.get('offline_wrong_scan_queue')) || [];

        if (pendingItems.value.length > 0 || deleteQueue.length > 0 || wrongScanQueue.length > 0) {
          console.log("Phát hiện có data kẹt trước đó, đang tiến hành đẩy lên Server...");
          await syncData();
        }

        const checkpointPayload = {
          areaIds: getDynamicAreaIds(userData.userAreaId),
          roleIdStr: String(userData.userRoleId)
        };

        const apiList = {
          checkpoints: () => CheckPointScanQr.postCheckPointView(checkpointPayload),
          // area_bu: () => AreaBU.postAreaBU({ areaId: userData.userAreaId }),
          list_route: () => PatrolShiftView.postPatrolShiftView({
            getOfflineData: true,
            areaId: userData.userAreaId,
          }),
          report_note_category: () => ReportNoteCategory.postReportNoteCategory(),
        };

        await store.dispatch('syncAllData', { apiList: apiList, mode: 'overlay' });
        router.replace('/home');

      } else {
        errorMessage.value = result?.message || t('login.message.1');
      }

    } else {
      const offlineUsers = await storageService.get('offline_users_dict');

      if (!offlineUsers || !offlineUsers[loginDetail.userCode]) {
        errorMessage.value = t('login.message.2');
        isLoading.value = false;
        return;
      }

      const savedAccount = offlineUsers[loginDetail.userCode];
      const inputHashed = hashPassword(loginDetail.userPassword);

      if (inputHashed === savedAccount.hashedPassword) {

        if (!savedAccount.profile.accessToken) {
          errorMessage.value = 'Phiên làm việc đã kết thúc. Vui lòng kết nối mạng để đăng nhập lại!';
          isLoading.value = false;
          return;
        }

        store.commit('SET_DATAUSER', savedAccount.profile);
        store.commit('SET_TOKEN', savedAccount.profile.accessToken);
        await storageService.set('user_data', savedAccount.profile);
        await storageService.set('user_token', savedAccount.profile.accessToken);

        await store.dispatch('initApp');
        router.replace('/home');
      } else {
        errorMessage.value = t('login.message.3');
      }
    }
  } catch (err: any) {
    errorMessage.value = t('login.message.4');
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

const handleScanQRLogin = async () => {
  try {
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== 'granted' && camera !== 'limited') {
      errorMessage.value = t('login.message.camera_permission_denied');
      return;
    }

    const { barcodes } = await BarcodeScanner.scan();

    if (barcodes.length > 0) {
      const scannedValue = barcodes[0].rawValue;
      loginDetail.userCode = scannedValue || '';
      errorMessage.value = '';
    }
  } catch (error) {
    const errStr = String(error).toLowerCase();

    if (errStr.includes('canceled') || errStr.includes('user canceled')) {
      return;
    }
  }
};

const { t, locale } = useI18n();

const onLangChange = async (lang: string) => {
  await storageService.set('app_language', lang);
};

useBackButton(10, () => {
  App.exitApp();
});

onMounted(async () => {
  const savedLang = await storageService.get('app_language');
  if (savedLang) {
    locale.value = savedLang;
  }
});
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100%;
  display: flex;
  justify-content: center;
  background: url('/assets/cty.jpg') center / cover no-repeat;
}

.login-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 400px;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: calc(env(safe-area-inset-top, 16px) + 12px) 20px calc(env(safe-area-inset-bottom, 16px) + 24px);
  box-sizing: border-box;
}

.login-topbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.lang-pill {
  width: 7.5rem;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  border: 1px solid #e2e8f0 !important;
  color: #334155 !important;
  min-height: 2.5rem;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
}

.lang-pill:hover,
.lang-pill.p-focus,
.lang-pill:not(.p-disabled):hover {
  background: #ffffff !important;
  border-color: #22c55e !important;
  color: #334155 !important;
}

.lang-pill :deep(.p-select-label) {
  color: #334155 !important;
  padding-block: 0.5rem;
}

.lang-pill:hover :deep(.p-select-label),
.lang-pill.p-focus :deep(.p-select-label) {
  color: #334155 !important;
}

.lang-pill :deep(.p-select-dropdown) {
  color: #64748b !important;
}

.lang-pill :deep(.p-select-dropdown-icon) {
  color: #64748b !important;
}

.lang-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #334155 !important;
}

.lang-flag {
  width: 1.35rem;
  height: 0.9rem;
  object-fit: cover;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12);
  flex-shrink: 0;
}

.lang-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: #0f172a;
}

.login-panel {
  margin: auto;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 24px;
  padding: 20px;
  box-shadow:
    0 24px 48px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.08);
}

.brand-block-inner {
  display: flex;
  align-items: center;
  justify-content: start;
  gap: 20px;
  /* justify-content: space-evenly; */
}

.brand-block {
  text-align: center;
  margin-bottom: 20px;
}

.brand-icon {
  width: 40px;
  height: 40px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: #fff;
  box-shadow: 0 5px 15px rgba(34, 197, 94, 0.35);
}

.brand-icon i {
  font-size: 1rem;
}

.brand-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #0f172a;
  line-height: 1.2;
}

.brand-title-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.brand-title-part {
  color: black;
  font-size: 1.75rem;
}

.brand-title .accent {
  color: #dc2626;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.form-field {
  margin-bottom: 18px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
  letter-spacing: 0.01em;
}

.field-control {
  width: 100%;
}

.username-row {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.username-input {
  flex: 1;
  min-width: 0;
}

.scan-btn {
  width: 3rem;
  min-height: 3rem;
  padding: 0;
}

.scan-btn :deep(.p-button-icon) {
  font-size: 1.5rem;
}

.error-message {
  margin: -4px 0 14px;
}

.submit-btn {
  margin-top: 4px;
  height: 3rem;
  font-weight: 600;
  border-radius: 12px;
}

.login-panel :deep(.p-inputtext),
.login-panel :deep(.p-password-input) {
  width: 100%;
  min-height: 3rem;
  border-radius: 12px;
  font-size: 1rem;
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid #cbd5e1;
}

.login-panel :deep(.p-inputtext:enabled:focus),
.login-panel :deep(.p-password-input:enabled:focus) {
  border-color: #22c55e;
  box-shadow: 0 0 0 1px #22c55e;
}

.login-panel :deep(.p-inputtext:disabled) {
  background: #f1f5f9;
  color: #475569;
  opacity: 1;
  cursor: not-allowed;
}

.login-panel :deep(.p-inputtext::placeholder),
.login-panel :deep(.p-password-input::placeholder) {
  color: #94a3b8;
}

.login-panel :deep(.p-iconfield) {
  width: 100%;
}

.login-panel :deep(.p-iconfield .p-inputicon) {
  color: #64748b;
}

.login-panel :deep(.p-password) {
  width: 100%;
}

.login-panel :deep(.p-password .p-password-toggle-mask-icon) {
  color: #64748b;
}

.login-panel :deep(.p-button.scan-btn) {
  border-radius: 12px;
}

.login-panel :deep(.p-message) {
  border-radius: 12px;
  width: 100%;
}
</style>

<style>
/* Panel dropdown render ra body (Portal) — cần style global */
.lang-select-panel.p-select-overlay {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  color: #0f172a !important;
}

.lang-select-panel .p-select-option {
  color: #0f172a !important;
  background: #ffffff !important;
}

.lang-select-panel .p-select-option:not(.p-disabled).p-focus,
.lang-select-panel .p-select-option:not(.p-disabled):hover {
  background: #f1f5f9 !important;
  color: #0f172a !important;
}

.lang-select-panel .p-select-option.p-select-option-selected {
  background: #ecfdf5 !important;
  color: #166534 !important;
}

.lang-select-panel .p-select-option.p-select-option-selected.p-focus,
.lang-select-panel .p-select-option.p-select-option-selected:hover {
  background: #d1fae5 !important;
  color: #166534 !important;
}
</style>
