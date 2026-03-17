<template>
    <ion-page>
        <div class="flex-content">
            <ion-card class="login-card">
                <ion-card-header>
                    <ion-card-title size="large">Login</ion-card-title>
                </ion-card-header>

                <ion-card-content>
                    <ion-input v-model="loginDetail.userCode" label="Username" label-placement="floating" fill="outline"
                        type="email" placeholder="Enter Username" :clear-input="true" class="ion-margin-bottom"
                        @ion-blur="markTouched"></ion-input>

                    <br>

                    <ion-input v-model="loginDetail.userPassword" label="Password" label-placement="floating"
                        fill="outline" placeholder="Enter Password" type="password" @keyup.enter="handleLogin">
                        <ion-input-password-toggle slot="end"></ion-input-password-toggle>
                    </ion-input>

                    <br>

                    <div v-if="errorMessage" style="color: red; text-align: center;">
                        {{ errorMessage }}
                    </div>

                    <ion-button :disabled="isButtonDisabled || isLoading" @click="handleLogin" expand="block"
                        color="success" class="ion-margin-top">
                        <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
                        <span v-else>Login</span>
                    </ion-button>
                </ion-card-content>
            </ion-card>
        </div>
    </ion-page>
</template>

<script setup lang="ts">
import {
    IonCardHeader, IonCardTitle, IonButton, IonCard, IonInput, IonInputPasswordToggle,
    IonCardContent, IonPage, IonSpinner
} from '@ionic/vue';
import { useRouter } from 'vue-router';
import { reactive, ref, computed } from 'vue';
import { useStore } from 'vuex';
import CryptoJS from 'crypto-js';

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

const handleLogin = async () => {
    if (isButtonDisabled.value) return;

    isLoading.value = true;
    errorMessage.value = '';

    try {
        const isOnline = store.state.isOnline;
        const now = new Date();
        const dateInfo = {
            psDay: now.getDate(),
            psMonth: now.getMonth() + 1,
            psYear: now.getFullYear()
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

                const apiList = {
                    checkpoints: () => CheckPointScanQr.postCheckPointView(),
                    checkpoints_id: () => PointReport.postPointReportView(),
                    area_bu: () => AreaBU.postAreaBU({ areaId: userData.userAreaId }),
                    list_route: () => PatrolShiftView.postPatrolShiftView(userData),
                    report_note_category: () => ReportNoteCategory.getReportNoteCategory(),
                    base_point_report: () => PointReport.postBasePointReportView(0),
                };

                // Gọi đồng bộ. UI sẽ tự được kích hoạt bên App.vue
                await store.dispatch('syncAllData', { apiList: apiList, mode: 'overlay' });

                router.replace('/home');
            } else {
                errorMessage.value = result?.message || 'Thông tin đăng nhập chưa chính xác';
            }

        } else {
            const offlineUsers = await storageService.get('offline_users_dict');

            if (!offlineUsers || !offlineUsers[loginDetail.userCode]) {
                errorMessage.value = 'Tài khoản chưa từng đăng nhập trên thiết bị này. Cần mạng cho lần đầu!';
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
                errorMessage.value = 'Mật khẩu không chính xác (Offline)!';
            }
        }
    } catch (err: any) {
        errorMessage.value = 'Không thể kết nối hoặc có lỗi xảy ra. Vui lòng thử lại!';
        console.error(err);
    } finally {
        isLoading.value = false;
    }
};
</script>

<style scoped>
.flex-content {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    background: #f4f5f8;
}

.login-card {
    width: 100%;
    max-width: 400px;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.error-message {
    color: var(--ion-color-danger);
    text-align: center;
    margin-top: 15px;
    font-size: 0.9rem;
    font-weight: 500;
}

.ion-margin-top {
    margin-top: 20px;
}

.ion-margin-bottom {
    margin-bottom: 15px;
}
</style>