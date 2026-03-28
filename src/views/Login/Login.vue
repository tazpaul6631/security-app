<template>
    <ion-page>
        <ion-fab vertical="top" horizontal="end" slot="fixed" class="lenguages">
            <ion-button fill="clear" color="light" @click="openLanguageSheet">
                <ion-icon :icon="globeOutline" slot="start"></ion-icon>
                {{ currentLangLabel }}
            </ion-button>
        </ion-fab>

        <ion-content class="login-content">
            <div class="flex-container">
                <ion-card class="login-card">
                    <ion-card-header>
                        <ion-card-title size="large">{{ $t('login.title') }}</ion-card-title>
                    </ion-card-header>

                    <ion-card-content>
                        <ion-input v-model="loginDetail.userCode" :label="$t('login.username')"
                            label-placement="floating" fill="outline" type="text" :clear-input="true"
                            class="ion-margin-bottom" @ion-blur="markTouched"></ion-input>

                        <br>

                        <ion-input v-model="loginDetail.userPassword" :label="$t('login.password')"
                            label-placement="floating" fill="outline" type="password" @keyup.enter="handleLogin">
                            <ion-input-password-toggle slot="end"></ion-input-password-toggle>
                        </ion-input>

                        <br>

                        <ion-button :disabled="isButtonDisabled || isLoading" @click="handleLogin" expand="block"
                            color="success" class="ion-margin-top">
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
    IonIcon
} from '@ionic/vue';
import { globeOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { reactive, ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import CryptoJS from 'crypto-js';
import { useI18n } from 'vue-i18n';

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
        const dateInfo = {
            psDay: now.getDate(),
            psMonth: now.getMonth() + 1,
            psYear: now.getFullYear(),
            // psHour: now.getHours()
        };

        if (isOnline) {
            const responseBU = await Login.postUserValidate(loginDetail);
            const result = responseBU.data;

            if (result?.success && result.data) {
                const userData = {
                    ...result.data,
                    ...dateInfo,
                };

                // 1. Cập nhật thông tin User mới vào Store và SQLite
                store.commit('SET_DATAUSER', userData);
                store.commit('SET_TOKEN', userData.userPassword);
                await storageService.set('user_data', userData);
                await storageService.set('user_token', userData.userPassword);

                // Lưu danh sách đăng nhập offline (giữ nguyên logic của bạn)
                let offlineUsers = await storageService.get('offline_users_dict') || {};
                offlineUsers[loginDetail.userCode] = {
                    profile: userData,
                    hashedPassword: hashPassword(loginDetail.userPassword)
                };
                await storageService.set('offline_users_dict', offlineUsers);

                const checkpointPayload = {
                    areaIds: getDynamicAreaIds(userData.userAreaId),
                    roleIdStr: String(userData.userRoleId) // Ép kiểu thành string "4" theo như API yêu cầu
                };

                // 2. CHUẨN BỊ DANH SÁCH ĐỒNG BỘ RIÊNG CHO USER NÀY
                const apiList = {
                    checkpoints: () => CheckPointScanQr.postCheckPointView(checkpointPayload),
                    checkpoints_id: () => PointReport.postPointReportView(),
                    // Lấy khu vực của User
                    area_bu: () => AreaBU.postAreaBU({ areaId: userData.userAreaId }),
                    // Lấy lộ trình của User trong ngày/giờ hiện tại
                    list_route: () => PatrolShiftView.postPatrolShiftView(userData),
                    // Lấy danh mục ghi chú
                    report_note_category: () => ReportNoteCategory.getReportNoteCategory(),
                    // Lấy lịch sử báo cáo (truyền 0 hoặc ID phù hợp)
                    base_point_report: () => PointReport.postBasePointReportView(0),
                };

                // 3. ĐỢI ĐỒNG BỘ XONG MỚI CHO VÀO TRANG CHỦ
                // mode: 'overlay' sẽ hiện màn hình chờ đen để chặn User bấm bậy
                await store.dispatch('syncAllData', { apiList: apiList, mode: 'overlay' });

                // 4. Chuyển trang sau khi dữ liệu đã sẵn sàng trong SQLite
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

// Khởi tạo i18n
const { t, locale } = useI18n();

// Hiển thị tên ngôn ngữ đang chọn
const currentLangLabel = computed(() => {
    if (locale.value === 'en') return 'EN';
    if (locale.value === 'zh') return '中文';
    return 'VN';
});

// Hàm mở bảng chọn ngôn ngữ
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

// Hàm lưu ngôn ngữ
const changeLanguage = async (lang: string) => {
    locale.value = lang; // Đổi UI lập tức
    await storageService.set('app_language', lang); // Lưu xuống máy
};

// Khôi phục ngôn ngữ khi mở app
onMounted(async () => {
    const savedLang = await storageService.get('app_language');
    if (savedLang) {
        locale.value = savedLang;
    }
});
</script>

<style scoped>
/* Định dạng màu nền cho ion-content */
.login-content {
    --background: #f4f5f8;
}

/* Ép form ra giữa màn hình nhưng vẫn cho phép cuộn khi cần */
.flex-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100%;
    /* QUAN TRỌNG: Dùng min-height thay vì height */
    padding: 20px;
    /* Thêm padding để khi cuộn không bị sát mép */
}

.login-card {
    width: 100%;
    max-width: 400px;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    margin: 0;
    /* Xóa margin thừa */
}

.ion-margin-top {
    margin-top: 20px;
}

.ion-margin-bottom {
    margin-bottom: 15px;
}

.lenguages {
    margin: 40px 10px 0 0;
    background-color: rgb(192, 214, 172);
    border-radius: 15px;
}
</style>