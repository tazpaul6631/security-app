<template>
    <ion-page>
        <ion-header>
            <ion-toolbar class="none-padding">
                <ion-buttons slot="start">
                    <ion-back-button default-href="/home"></ion-back-button>
                </ion-buttons>
                <ion-title>Lộ trình tuần tra</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content>
            <div v-if="isLoading" class="ion-padding ion-text-center">
                <ion-spinner name="crescent"></ion-spinner>
                <p>Đang tải lộ trình...</p>
            </div>

            <transition v-else name="fade-route" mode="out-in">
                <div v-if="currentActiveRoute" :key="currentActiveRoute.routeId">
                    <ion-card class="inspection-grid-card">
                        <ion-card-header>
                            <ion-card-title>{{ currentActiveRoute.routeName }}</ion-card-title>
                            <ion-card-subtitle>
                                Mã: {{ currentActiveRoute.routeCode }} | Giờ trực: {{ currentActiveRoute.psHourFrom }}h
                                <br />
                                <span class="timer-display" :class="timerColorClass"
                                    v-if="currentActiveRoute.planSecond !== undefined">
                                    <ion-icon class="icon-clock" :icon="timeOutline"></ion-icon> Thời gian: {{
                                        formattedTime }}
                                </span>
                            </ion-card-subtitle>
                        </ion-card-header>

                        <ion-card-content>
                            <card-route-points :details="currentActiveRoute.routeDetails" />

                            <div class="route-actions-bar active-controls">
                                <ion-button color="danger" @click="confirmCancelRoute" class="btn-cancel">
                                    <ion-icon slot="start" :icon="trashOutline"></ion-icon>
                                    HỦY BỎ
                                </ion-button>
                                <ion-button color="success" class="btn-continue"
                                    @click="handleContinueScanning(currentActiveRoute.routeId)">
                                    <ion-icon slot="start" :icon="qrCodeOutline"></ion-icon>
                                    SCAN
                                </ion-button>
                            </div>
                        </ion-card-content>
                    </ion-card>
                </div>

                <div v-else class="ion-padding ion-text-center no-route-container">
                    <div class="no-route-content">
                        <ion-icon :icon="calendarOutline" class="big-icon"></ion-icon>

                        <div v-if="hasDataButFinished">
                            <h3>Lộ trình {{ currentHour }}h đã hoàn thành</h3>
                            <p>Bạn đã hoàn tất tất cả các điểm quét trong khung giờ này.</p>
                        </div>
                        <div v-else>
                            <h3>Không tìm thấy lộ trình {{ currentHour }}h</h3>
                            <p>Dữ liệu ca trực chưa được tải hoặc không có ca trực trong khung giờ này.</p>
                        </div>
                        <ion-button fill="outline" @click="router.replace('/home')" class="ion-margin-top">
                            Quay lại trang chủ
                        </ion-button>
                    </div>
                </div>
            </transition>

            <ion-alert :is-open="isCancelAlertOpen" header="Cảnh báo!"
                message="Bạn có chắc chắn muốn hủy? Toàn bộ dữ liệu đã quét sẽ bị mất." :buttons="cancelButtons"
                @didDismiss="isCancelAlertOpen = false" />
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import {
    IonPage, IonHeader, IonToolbar, IonTitle, IonIcon, IonButtons, IonBackButton,
    IonCardContent, IonContent, IonAlert, IonButton, IonCard, IonCardHeader,
    IonCardSubtitle, IonCardTitle, IonSpinner, onIonViewWillEnter, loadingController
} from '@ionic/vue';
import { qrCodeOutline, calendarOutline, trashOutline, timeOutline } from 'ionicons/icons';
import CardRoutePoints from '@/components/CardRoutePoints.vue';
import { scannerService } from '@/services/scanner.service';
import storageService from '@/services/storage.service';
import PatrolShiftView from '@/api/PatrolShiftView';

// IMPORT GLOBAL TIMER
import { useRouteTimer } from '@/composables/useRouteTimer';
import PatrolShift from '@/api/PatrolShift';

// Lấy biến và hàm từ Global Timer ra sử dụng
const { formattedTime, timerColorClass, clearTimer, restoreTimer } = useRouteTimer();

// --- Interfaces ---
interface RouteDetail {
    rdId: number;
    cpId: number;
    cpName: string;
    status: number;
}

interface Route {
    routeId: number;
    routeName: string;
    routeCode: string;
    psHourFrom: number;
    psHourTo: number;
    planSecond?: number;
    routeDetails: RouteDetail[];
    areaId: number;
    roleId: number;
    psId: number;
    isComplete?: boolean;
}

const store = useStore();
const router = useRouter();
const isCancelAlertOpen = ref(false);
const isLoading = ref(true);
const isScanning = ref(false);
const userRoleIsAdmin = ref();

const shiftDataList = ref<Route[]>([]);
const currentHour = ref(new Date().getHours());
let timer: any = null;
const lockedRouteId = computed(() => store.state.unfinishedRouteId);

// ==========================================
// 1. KHAI BÁO LỘ TRÌNH HIỆN TẠI
// ==========================================
const currentActiveRoute = computed(() => {
    const routes = shiftDataList.value;
    const userData = store.state.dataUser;
    if (!userData || !Array.isArray(routes)) return null;

    const uRole = Number(userData.userRoleId);
    const uArea = Number(userData.userAreaId);
    const hNow = currentHour.value;

    // ƯU TIÊN 1: Lộ trình đang làm dở (Locked) - Dù quá giờ vẫn phải hiện ca này
    if (lockedRouteId.value !== null) {
        const lockedRoute = routes.find(r => Number(r.routeId) === Number(lockedRouteId.value));
        if (lockedRoute) {
            const isFinished = lockedRoute.routeDetails.every((p: any) => p.status === 1);
            if (!isFinished) return { ...lockedRoute };
        }
    }

    // ƯU TIÊN 2: Tìm lộ trình mới theo khung giờ hiện tại
    const foundRoute = routes.find((r: any) => {
        if (Number(r.areaId) !== uArea || Number(r.roleId) !== uRole) return false;

        const isMatchHour = hNow >= Number(r.psHourFrom) && hNow <= Number(r.psHourTo);
        const isFinished = r.routeDetails.every((p: any) => p.status === 1);

        return isMatchHour && !isFinished && !r.isComplete;
    });

    return foundRoute ? { ...foundRoute } : null;
});

// ==========================================
// 2. KHÔI PHỤC TIMER KHI RELOAD
// ==========================================
watch(() => currentActiveRoute.value, async (newRoute) => {
    if (newRoute && newRoute.psId) {
        console.log("Đã cập nhật psId mới cho ca trực:", newRoute.psId);
        store.commit('SET_PSID', newRoute.psId);
        // Có thể lưu thêm vào storage nếu cần dự phòng reload page
        storageService.set('current_ps_id', newRoute.psId);
    }

    if (newRoute) {
        await restoreTimer(newRoute.routeId);
    }
}, { immediate: true });

// ==========================================
// 3. CÁC HÀM XỬ LÝ QUÉT MÃ (Sắp xếp lên trên)
// ==========================================
// Hàm xử lý kết quả quét chung (Cả Camera và Unitech đều gọi hàm này)
const processScannedData = async (qrCodeString: string, routeId: number) => {
    if (!qrCodeString) return;

    // 1. Khởi tạo Loading
    const loading = await loadingController.create({
        message: 'Đang kiểm tra điểm quét...',
        spinner: 'crescent',
        cssClass: 'custom-loading' // Nếu bạn muốn style riêng
    });

    await loading.present();

    try {
        // Cập nhật khóa vào Store và Storage
        store.commit('SET_UNFINISHED_ROUTE_ID', routeId);

        // 2. Gọi logic xử lý nặng (Check lộ trình, API, SQLite)
        await scannerService.processQRString(store, router, routeId, qrCodeString);

    } catch (error) {
        console.error("Lỗi xử lý dữ liệu quét:", error);
    } finally {
        // 3. Quan trọng: Luôn tắt loading dù thành công hay lỗi
        // Lưu ý: Nếu processQRString chuyển trang thành công, loading vẫn sẽ đóng
        await loading.dismiss();
    }
};

let scanBuffer = '';
let scanTimeout: any = null;

const handleHardwareScan = (e: KeyboardEvent) => {
    console.log(e);

    if (e.key === 'Enter') {
        if (scanBuffer.length > 3 && currentActiveRoute.value) {
            processScannedData(scanBuffer, currentActiveRoute.value.routeId);
        }
        scanBuffer = '';
        return;
    }

    if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return;

    scanBuffer += e.key;

    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
        scanBuffer = '';
    }, 50);
};

// Nút bấm cho Điện thoại thường (Mở Camera)
const handleContinueScanning = async (routeId: number) => {
    if (isScanning.value) return;
    isScanning.value = true;
    try {
        const result: any = await scannerService.startScanning(store, router, routeId);

        if (result && typeof result === 'string') {
            await processScannedData(result, routeId);
        }
    } catch (error: any) {
        console.error("Lỗi scanner:", error);
        alert("Để quét mã trên thiết bị này, vui lòng bấm nút cứng (vật lý) bên hông hoặc đầu máy!");
    } finally {
        isScanning.value = false;
    }
};

const hasDataButFinished = computed(() => {
    const routes = shiftDataList.value;
    if (!Array.isArray(routes)) return false;

    // Tìm xem có ca trực nào khớp với giờ hiện tại không
    const routeInHour = routes.find(r =>
        currentHour.value >= Number(r.psHourFrom) &&
        currentHour.value <= Number(r.psHourTo)
    );

    // Nếu tìm thấy ca đó và tất cả điểm đã status = 1 thì mới là "Đã hoàn thành"
    if (routeInHour) {
        return routeInHour.routeDetails.every(p => p.status === 1);
    }

    return false; // Không tìm thấy ca trực nào cho giờ này trong Store
});

// ==========================================
// 4. LIFECYCLE VÀ API (onMounted để bên dưới các hàm trên)
// ==========================================
const updateSystemTime = () => {
    const now = new Date();
    const hourNow = now.getHours();
    if (hourNow !== currentHour.value) {
        currentHour.value = hourNow;
    }
};

const handleAppWakeUp = () => {
    if (document.visibilityState === 'visible') {
        updateSystemTime();
    }
};

onIonViewWillEnter(async () => {
    isLoading.value = true;

    // Đảm bảo Store đã khôi phục dữ liệu từ SQLite (bao gồm cả unfinishedRouteId)
    if (!store.state.isHydrated) {
        await store.dispatch('initApp');
    }

    updateSystemTime();
    userRoleIsAdmin.value = store.state.dataUser?.userRoleIsAdmin;

    if (!navigator.onLine) {
        shiftDataList.value = store.state.dataListRoute || [];
    } else {
        try {
            const areaId = store.state.dataUser?.userAreaId;
            const now = new Date();
            const dateInfo = {
                psDay: now.getDate(),
                psMonth: now.getMonth() + 1,
                psYear: now.getFullYear(),
                psHour: now.getHours(),
                isComplete: false,
                areaId: areaId
            };

            const response: any = await PatrolShiftView.postPatrolShiftView(dateInfo);
            const apiDataRaw = response?.data?.data || response?.data || [];

            // Store sẽ tự động thực hiện Merge Status và giữ ca dở dang trong mutation này
            store.commit('SET_DATA_LIST_ROUTE', apiDataRaw);

            // Cập nhật lại biến hiển thị từ dữ liệu đã được Store xử lý xong
            shiftDataList.value = store.state.dataListRoute;

            // Lưu bản sao xuống máy
            await storageService.set('list_route', store.state.dataListRoute);
        } catch (error) {
            shiftDataList.value = store.state.dataListRoute || [];
        }
    }
    isLoading.value = false;
});

onMounted(async () => {
    updateSystemTime();
    window.addEventListener('visibilitychange', handleAppWakeUp);
    window.addEventListener('focus', updateSystemTime);

    // 1. Lắng nghe Keyboard Wedge từ tia Laser
    window.addEventListener('keydown', handleHardwareScan);

    // 2. Lắng nghe từ Android Bridge
    (window as any).returnResult = (data: any) => {
        if (currentActiveRoute.value && data) {
            let qrString = typeof data === 'string' ? data : JSON.stringify(data);
            processScannedData(qrString, currentActiveRoute.value.routeId);
        }
    };

    timer = setInterval(updateSystemTime, 5000);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
    window.removeEventListener('visibilitychange', handleAppWakeUp);
    window.removeEventListener('focus', updateSystemTime);

    // Cleanup listeners
    window.removeEventListener('keydown', handleHardwareScan);
    delete (window as any).returnResult;
});

// ==========================================
// 5. CÁC HÀM TIỆN ÍCH KHÁC
// ==========================================
const confirmCancelRoute = () => {
    isCancelAlertOpen.value = true;
};

const cancelButtons = [
    { text: 'Đóng', role: 'cancel' },
    {
        text: 'Đồng ý hủy',
        role: 'confirm',
        cssClass: 'alert-button-confirm',
        handler: async () => {
            const currentRoute = currentActiveRoute.value;
            if (!currentRoute) return;

            const removeData = {
                routeId: currentRoute.routeId,
                psId: currentRoute.psId,
                updatedBy: store.state.dataUser?.userId
            };

            // Lệnh API có thể thành công hoặc thất bại tùy mạng
            try {
                await PatrolShift.postRemovePatrolShift(removeData);
            } catch (error) {
                console.warn("Không thể báo hủy lên Server (có thể đang Offline), nhưng vẫn tiến hành xóa Local.");
            }

            clearTimer(currentRoute.routeId);

            // Xóa sạch dấu vết trong Store và SQLite
            await store.dispatch('resetCurrentRoute');

            // Cập nhật lại giao diện ngay lập tức
            shiftDataList.value = store.state.dataListRoute;
            router.replace('/home');
        }
    }
];
</script>

<style scoped>
/* Thêm CSS cho Timer */
.timer-display {
    display: flex;
    margin-top: 5px;
    font-size: 0.9rem;
    color: #666;
    transition: color 0.3s ease;
}

.icon-clock {
    padding-right: 5px;
}

.text-success {
    color: var(--ion-color-success, #2dd36f);
    font-weight: bold;
}

.text-danger {
    color: var(--ion-color-danger, #eb445a);
    font-weight: bold;
    animation: pulse-red 1s infinite;
}

@keyframes pulse-red {
    0% {
        opacity: 1;
    }

    50% {
        opacity: 0.5;
    }

    100% {
        opacity: 1;
    }
}

/* Layout */
.active-controls {
    display: flex;
    gap: 12px;
    justify-content: space-between;
}

.route-actions-bar {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px dashed #ddd;
}

.btn-cancel,
.btn-continue {
    --border-radius: 8px;
    height: 50px;
    font-weight: bold;
    flex: 1;
}

/* No Route State */
.no-route-container {
    height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.big-icon {
    font-size: 80px;
    color: #cbd5e0;
    margin-bottom: 16px;
}

/* Animations */
.fade-route-enter-active,
.fade-route-leave-active {
    transition: all 0.4s ease;
}

.fade-route-enter-from {
    opacity: 0;
    transform: translateY(15px);
}

.fade-route-leave-to {
    opacity: 0;
    transform: translateY(-15px);
}

.inspection-grid-card {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    background-color: floralwhite;
}
</style>