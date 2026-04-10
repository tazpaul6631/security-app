<template>
  <ion-page>
    <ion-content class="login-content">
      <ion-fab vertical="top" slot="fixed" class="lang-fab">
        <ion-grid>
          <ion-row>
            <ion-col class="ion-text-start ion-align-self-center" color="medium">
              <div class="logo-section">
                <div class="app-title">
                  <strong>
                    Internal
                    <ion-text color="danger">Patrol</ion-text>
                  </strong>
                </div>
              </div>
            </ion-col>
            <ion-col size="auto" class="ion-text-end ion-align-self-center">
              <ion-button class="lang-btn" fill="clear" @click="openLanguageSheet">
                <ion-icon :icon="languageOutline" slot="start"></ion-icon>
                {{ currentLangLabel }}
              </ion-button>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-fab>

      <div class="flex-container">
        <ion-card class="login-card">
          <ion-card-header>
            <ion-card-title class="ion-text-center" size="large">{{ $t('login.title') }}</ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <div class="action-buttons ion-margin-top">
              <ion-input v-model="loginDetail.userCode" disabled :label="$t('login.username')"
                label-placement="floating" fill="outline" type="text" :clear-input="true" class="ion-margin-bottom"
                @ion-blur="markTouched"></ion-input>

              <ion-button class="scan-btn ion-margin-bottom" color="success" fill="outline" @click="handleScanQRLogin">
                <ion-icon :icon="qrCodeOutline" slot="icon-only"></ion-icon>
              </ion-button>
            </div>

            <ion-input v-model="loginDetail.userPassword" :label="$t('login.password')" label-placement="floating"
              fill="outline" type="password" class="ion-margin-bottom" @keyup.enter="handleLogin">
              <ion-input-password-toggle slot="end"></ion-input-password-toggle>
            </ion-input>

            <div v-if="errorMessage" class="ion-text-center ion-text-danger ion-margin-bottom">
              <ion-label color="danger">{{ errorMessage }}</ion-label>
            </div>

            <ion-button class="login-btn" :disabled="isButtonDisabled || isLoading" @click="handleLogin"
              color="success">
              <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
              <span v-else>{{ $t('login.btn_login') }}</span>
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonCardHeader, IonCardTitle, IonButton, IonCard, IonInput, IonInputPasswordToggle,
  IonCardContent, IonPage, IonSpinner, IonContent, IonFab, actionSheetController,
  IonIcon, IonLabel, IonText, IonGrid, IonRow, IonCol, useBackButton
} from '@ionic/vue';
import { languageOutline, qrCodeOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { reactive, ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import CryptoJS from 'crypto-js';
import { useI18n } from 'vue-i18n';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { App } from '@capacitor/app';

// Các API và Service
import Login from '@/api/Login';
import storageService from '@/services/storage.service';
import CheckPointScanQr from '@/api/CheckPointScanQr';
import PointReport from '@/api/PointReport';
import AreaBU from '@/api/AreaBU';
import ReportNoteCategory from '@/api/ReportNoteCategory';
import PatrolShiftView from '@/api/PatrolShiftView';

const router = useRouter();
const store = useStore();

const errorMessage = ref('');
const isLoading = ref(false);

const loginDetail = reactive({
  userCode: '',
  userPassword: '',
});

const isButtonDisabled = computed(() => {
  return !loginDetail.userCode.trim() || !loginDetail.userPassword.trim();
});

const markTouched = (event: any) => {
  event.target.classList.add('ion-touched');
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
    const now = new Date();
    const currentHour = now.getHours();
    const hoursArray = [];
    for (let i = currentHour; i <= 23; i++) {
      hoursArray.push(i);
    }
    const dateInfo = {
      psDay: now.getDate(),
      psMonth: now.getMonth() + 1,
      psYear: now.getFullYear(),
      psHours: hoursArray
    };

    if (isOnline) {
      const responseBU = await Login.postUserValidate(loginDetail);
      const result = responseBU.data;

      if (result?.success && result.data) {
        const userData = {
          ...result.data,
          ...dateInfo,
        };

        store.commit('SET_DATAUSER', userData);
        store.commit('SET_TOKEN', userData.userPassword);
        await storageService.set('user_data', userData);
        await storageService.set('user_token', userData.userPassword);

        let offlineUsers = await storageService.get('offline_users_dict') || {};
        offlineUsers[loginDetail.userCode] = {
          profile: userData,
          hashedPassword: hashPassword(loginDetail.userPassword)
        };
        await storageService.set('offline_users_dict', offlineUsers);

        const checkpointPayload = {
          areaIds: getDynamicAreaIds(userData.userAreaId),
          roleIdStr: String(userData.userRoleId)
        };

        const apiList = {
          checkpoints: () => CheckPointScanQr.postCheckPointView(checkpointPayload),
          // checkpoints_id: () => PointReport.postPointReportView(),
          area_bu: () => AreaBU.postAreaBU({ areaId: userData.userAreaId }),
          list_route: () => PatrolShiftView.postPatrolShiftView(userData),
          report_note_category: () => ReportNoteCategory.getReportNoteCategory(),
          base_point_report: () => PointReport.postBasePointReportView(0),
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
        store.commit('SET_DATAUSER', savedAccount.profile);
        store.commit('SET_TOKEN', savedAccount.profile.userPassword);
        await storageService.set('user_data', savedAccount.profile);
        await storageService.set('user_token', savedAccount.profile.userPassword);

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
    // Yêu cầu quyền truy cập Camera
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== 'granted' && camera !== 'limited') {
      errorMessage.value = t('login.message.camera_permission_denied');
      return;
    }

    // Mở màn hình quét mã
    const { barcodes } = await BarcodeScanner.scan();

    if (barcodes.length > 0) {
      const scannedValue = barcodes[0].rawValue;

      loginDetail.userCode = scannedValue || '';
    }
  } catch (error) {
    const errStr = String(error).toLowerCase();

    // Bỏ qua nếu user chủ động tắt giao diện camera
    if (errStr.includes('canceled') || errStr.includes('user canceled')) {
      return;
    }
  }
};

const { t, locale } = useI18n();

const currentLangLabel = computed(() => {
  if (locale.value === 'en') return 'EN';
  if (locale.value === 'zh') return '中文';
  return 'VN';
});

const openLanguageSheet = async () => {
  const actionSheet = await actionSheetController.create({
    header: t('login.lang_select'),
    buttons: [
      { text: 'Tiếng Việt', handler: () => changeLanguage('vi') },
      { text: 'English', handler: () => changeLanguage('en') },
      { text: '中文', handler: () => changeLanguage('zh') },
      { text: t('login.cancel'), role: 'cancel' }
    ]
  });
  await actionSheet.present();
};

const changeLanguage = async (lang: string) => {
  locale.value = lang;
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
/* Màu nền tổng thể kết hợp Hình ảnh + Lớp phủ đen mờ */
.login-content {
  --background: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0)), url('/assets/cty.jpg') no-repeat 50% / cover;
}

/* Khu vực Logo */
.logo-company {
  height: auto;
}

/* Chữ Internal Patrol đổi sang màu trắng để nổi bật trên nền ảnh tối */
.app-title {
  font-size: 35px;
  letter-spacing: 0.5px;
  display: inline-block;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  color: darkgray;
}

/* Card Đăng nhập - Hiệu ứng Kính Mờ (Glassmorphism) */
.login-card {
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Nút chọn ngôn ngữ */
.lang-fab {
  margin-top: env(safe-area-inset-top, 20px);
  width: 100%;
}

.lang-btn {
  /* Nút đổi ngôn ngữ hơi trong suốt để tệp với nền */
  background-color: rgba(220, 247, 196, 0.8);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 1);
  border-radius: 20px;
  color: #ffffff;
  font-weight: 600;
  --padding-start: 12px;
  --padding-end: 12px;
  --ripple-color: transparent;
}

/* Ép form ra giữa màn hình dọc/ngang */
.flex-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  padding: 20px;
}

/* Bố cục chứa 2 nút Đăng nhập & Quét mã */
.action-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
}

.scan-btn {
  margin: 0;
  width: 50px;
  height: 48px;
  --border-radius: 8px;
}

.login-btn {
  margin: 0;
  flex: 1;
  height: 48px;
  --border-radius: 8px;
  --ion-color-contrast: white !important;
  width: 100%;
}

.ion-margin-top {
  margin-top: 20px;
}

.ion-margin-bottom {
  margin-bottom: 15px;
}
</style>