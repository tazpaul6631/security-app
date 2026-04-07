<template>
    <ion-page>
        <ion-header>
            <ion-toolbar class="none-padding">
                <ion-buttons slot="start">
                    <ion-back-button default-href="/home"></ion-back-button>
                </ion-buttons>
                <ion-title>{{ $t('page.routes') }}</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content>
            <div v-if="isLoading" class="ion-padding ion-text-center">
                <ion-spinner name="crescent"></ion-spinner>
                <p>{{ $t('routes.loading-route') }}</p>
            </div>

            <transition v-else name="fade-route" mode="out-in">
                <div v-if="currentActiveRoute" :key="currentActiveRoute.routeId">
                    <ion-card class="inspection-grid-card">
                        <ion-card-header>
                            <ion-card-title>{{ currentActiveRoute.routeName }}</ion-card-title>
                            <ion-card-subtitle>
                                {{ $t('routes.code') }} {{ currentActiveRoute.routeCode }} | {{ $t('routes.shift') }} {{
                                    currentActiveRoute.psHourFrom }}h
                                <br />
                                <span class="timer-display" :class="timerColorClass" v-show="formattedTime">
                                    <ion-icon :icon="timeOutline" class="icon-clock"></ion-icon>
                                    {{ $t('routes.countdown') }} {{ formattedTime }}
                                </span>
                            </ion-card-subtitle>
                        </ion-card-header>

                        <ion-card-content>
                            <card-route-points ref="cardRoutePointsRef" :details="currentActiveRoute.routeDetails" />
                        </ion-card-content>
                    </ion-card>
                </div>

                <div v-else class="ion-padding ion-text-center no-route-container">
                    <div class="no-route-content">
                        <ion-icon :icon="calendarOutline" class="big-icon"></ion-icon>

                        <div v-if="hasDataButFinished">
                            <h3>{{ $t('routes.txt-info', { currentHour: currentHour }) }}</h3>
                            <p>{{ $t('routes.all-scanned') }}</p>
                        </div>
                        <div v-else>
                            <h3>{{ $t('routes.route-not-found', { currentHour: currentHour }) }}</h3>
                            <p>{{ $t('routes.no-shift-data') }}</p>
                        </div>
                        <ion-button fill="outline" @click="router.replace('/home')" class="ion-margin-top">
                            {{ $t('routes.go-home') }}
                        </ion-button>
                    </div>
                </div>
            </transition>

            <ion-alert :is-open="isCancelAlertOpen" :header="$t('routes.warning-title')"
                :message="$t('routes.cancel-confirm-msg')" :buttons="cancelButtons"
                @didDismiss="isCancelAlertOpen = false" />
        </ion-content>

        <ion-footer v-if="!isLoading && currentActiveRoute" class="ion-no-border">
            <ion-toolbar class="ion-padding-horizontal ion-padding-bottom">
                <div class="active-controls">
                    <ion-button color="danger" @click="confirmCancelRoute" class="btn-cancel">
                        <ion-icon slot="start" :icon="trashOutline"></ion-icon>
                        {{ $t('routes.cancel') }}
                    </ion-button>
                    <ion-button color="success" class="btn-continue"
                        @click="handleContinueScanning(currentActiveRoute.routeId)">
                        <ion-icon slot="start" :icon="qrCodeOutline"></ion-icon>
                        {{ $t('routes.scan') }}
                    </ion-button>
                </div>
            </ion-toolbar>
        </ion-footer>

    </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import {
    IonPage, IonHeader, IonToolbar, IonTitle, IonIcon, IonButtons, IonBackButton,
    IonCardContent, IonContent, IonAlert, IonButton, IonCard, IonCardHeader,
    IonCardSubtitle, IonCardTitle, IonSpinner, IonFooter, onIonViewWillEnter,
    loadingController, useBackButton
} from '@ionic/vue';
import { qrCodeOutline, calendarOutline, trashOutline, timeOutline } from 'ionicons/icons';
import CardRoutePoints from '@/components/CardRoutePoints.vue';
import { scannerService } from '@/services/scanner.service';
import storageService from '@/services/storage.service';
import PatrolShiftView from '@/api/PatrolShiftView';
import { ImageService } from '@/services/image.service';

// IMPORT GLOBAL TIMER
import { useRouteTimer } from '@/composables/useRouteTimer';
import PatrolShift from '@/api/PatrolShift';
import { useOfflineManager } from '@/composables/useOfflineManager';
import { useI18n } from 'vue-i18n';

// Lấy biến và hàm từ Global Timer ra sử dụng
const { formattedTime, timerColorClass, clearTimer, restoreTimer, stopTimer, remainingSeconds, currentTimerRouteId } = useRouteTimer();

// --- Interfaces ---
interface RouteDetail {
    rdId: number;
    cpId: number;
    cpName: string;
    rdIsComplete: boolean;
    status: number;
    cpPriority: number;
}

interface Route {
    routeId: number;
    routeName: string;
    routeCode: string;
    psHourFrom: number;
    psHourTo: number;
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
const { t } = useI18n();
const cardRoutePointsRef = ref<any>(null);

// ==========================================
// 1. KHAI BÁO LỘ TRÌNH HIỆN TẠI
// ==========================================
const currentActiveRoute = computed(() => {
    const routes = shiftDataList.value;
    const userData = store.state.dataUser;

    // Lấy thêm psId đang bị khóa từ Store
    const lockedPsId = store.state.psId;

    if (!userData || !Array.isArray(routes)) return null;

    const uRole = Number(userData.userRoleId);
    const uArea = Number(userData.userAreaId);
    const hNow = currentHour.value;

    // ƯU TIÊN 1: Lộ trình đang làm dở (Locked) - Dù quá giờ vẫn phải hiện ca này
    if (lockedRouteId.value !== null) {

        // Tìm CHÍNH XÁC cả 2 điều kiện
        let lockedRoute;
        if (lockedPsId) {
            lockedRoute = routes.find((r: any) =>
                Number(r.routeId) === Number(lockedRouteId.value) &&
                Number(r.psId) === Number(lockedPsId)
            );
        }

        // Nếu không tìm thấy bằng psId, fallback về tìm bằng routeId
        if (!lockedRoute) {
            lockedRoute = routes.find((r: any) => Number(r.routeId) === Number(lockedRouteId.value));
        }

        if (lockedRoute) {
            const isFinished = lockedRoute.routeDetails.every((p: any) => p.rdIsComplete);
            if (!isFinished) return { ...lockedRoute };
        }
    }

    // ƯU TIÊN 2: Tìm lộ trình mới theo khung giờ hiện tại
    const foundRoute = routes.find((r: any) => {
        if (Number(r.areaId) !== uArea || Number(r.roleId) !== uRole) return false;

        const f = Number(r.psHourFrom);
        const t = Number(r.psHourTo);
        let isMatchHour = false;

        // Xử lý ca trong ngày và ca qua đêm
        if (f <= t) {
            isMatchHour = hNow >= f && hNow <= t;
        } else {
            // Ca qua đêm (Ví dụ 21h tối đến 6h sáng)
            isMatchHour = hNow >= f || hNow <= t;
        }

        const isFinished = r.routeDetails.every((p: any) => p.rdIsComplete);
        return isMatchHour && !isFinished && !r.isComplete;
    });

    return foundRoute ? { ...foundRoute } : null;
});

// ==========================================
// 2. KHÔI PHỤC TIMER KHI RELOAD & CHUYỂN CA
// ==========================================
watch(() => currentActiveRoute.value, async (newRoute) => {
    if (newRoute && newRoute.psId) {
        store.commit('SET_PSID', newRoute.psId);
        storageService.set('current_ps_id', newRoute.psId);
    }

    if (newRoute) {
        // 1. Kiểm tra xem ca này đã có điểm nào quét chưa (status = 1)
        const hasStarted = newRoute.routeDetails.some((p: any) => p.rdIsComplete);

        // 2. Hoặc kiểm tra xem nó có đang bị khóa dở dang không
        const isUnfinished = Number(newRoute.routeId) === Number(lockedRouteId.value);

        // CHỈ KHÔI PHỤC NẾU THỰC SỰ ĐÃ BẮT ĐẦU LÀM
        if (hasStarted || isUnfinished) {
            await restoreTimer(newRoute.routeId);
        } else {
            // CA MỚI TINH (Chưa làm gì) ---
            if (currentTimerRouteId.value !== null && currentTimerRouteId.value !== newRoute.routeId) {
                await clearTimer(currentTimerRouteId.value);
            }
        }
    } else {
        // NẾU KHÔNG CÓ LỘ TRÌNH NÀO HOẠT ĐỘNG
        // Tránh tình trạng clear nhầm Storage lúc API đang load làm currentActiveRoute bị null tạm thời
        if (!lockedRouteId.value && !isLoading.value) {
            if (currentTimerRouteId.value !== null) {
                await clearTimer(currentTimerRouteId.value);
            } else {
                stopTimer();
                remainingSeconds.value = 0;
            }
        }
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
        message: t('routes.verifying-checkpoint'),
        spinner: 'crescent',
        cssClass: 'custom-loading' // Nếu muốn style riêng
    });

    await loading.present();

    try {
        // Gọi logic xử lý nặng (Check lộ trình, API, SQLite)
        await scannerService.processQRString(store, router, routeId, qrCodeString, t);

    } catch (error) {
        console.error("Lỗi xử lý dữ liệu quét:", error);
    } finally {
        // 3. Quan trọng: Luôn tắt loading dù thành công hay lỗi
        // Lưu ý: Nếu processQRString chuyển trang thành công, loading vẫn sẽ đóng
        await loading.dismiss();
    }
};

// Nút bấm cho Điện thoại thường (Mở Camera)
const handleContinueScanning = async (routeId: number) => {
    if (isScanning.value) return;

    isScanning.value = true;

    try {
        const result = await scannerService.startScanning(store, router, routeId, t);
        if (result) {
            await processScannedData(result, routeId);
        }
    } catch (error: any) {
        const errStr = String(error).toLowerCase();

        // Bỏ qua nếu user chủ động tắt giao diện camera
        if (errStr.includes('canceled') || errStr.includes('user canceled')) {
            return;
        }
    } finally {
        isScanning.value = false;
    }
};

const hasDataButFinished = computed(() => {
    const routes = shiftDataList.value;
    if (!Array.isArray(routes)) return false;

    const routeInHour = routes.find(r => {
        const f = Number(r.psHourFrom);
        const t = Number(r.psHourTo);
        if (f <= t) {
            return currentHour.value >= f && currentHour.value <= t;
        } else {
            return currentHour.value >= f || currentHour.value <= t;
        }
    });

    if (routeInHour) {
        return routeInHour.isComplete || routeInHour.routeDetails.every(p => p.rdIsComplete);
    }
    return false;
});

// ==========================================
// 4. LIFECYCLE VÀ API
// ==========================================
const updateSystemTime = async () => {
    const now = new Date();
    const hourNow = now.getHours();
    if (hourNow !== currentHour.value) {
        currentHour.value = hourNow;

        if (!lockedRouteId.value) await loadRouteData();
    }
};

const handleAppWakeUp = () => {
    if (document.visibilityState === 'visible') {
        updateSystemTime();
    }
};

const loadRouteData = async () => {
    isLoading.value = true;

    if (!store.state.isOnline) {
        shiftDataList.value = store.state.dataListRoute || [];
    } else {
        try {
            const userData = store.state.dataUser?.data || store.state.dataUser || {};
            const areaId = userData.userAreaId;

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
                userAreaId: areaId,
                psHours: hoursArray
            };

            const response: any = await PatrolShiftView.postPatrolShiftView(dateInfo);
            const apiDataRaw = response?.data?.data || response?.data || [];

            // Vuex sẽ kiểm tra xem ca bị khóa đã isComplete chưa, nếu có nó sẽ TỰ MỞ KHÓA
            store.commit('SET_DATA_LIST_ROUTE', apiDataRaw);

            shiftDataList.value = store.state.dataListRoute;
            await storageService.set('list_route', store.state.dataListRoute);

        } catch (error) {
            shiftDataList.value = store.state.dataListRoute || [];
        }
    }

    isLoading.value = false;
};

onIonViewWillEnter(async () => {
    // Đảm bảo Store đã khôi phục dữ liệu từ SQLite
    if (!store.state.isHydrated) {
        await store.dispatch('initApp');
    }

    // Cập nhật giờ trước khi load
    const now = new Date();
    currentHour.value = now.getHours();
    userRoleIsAdmin.value = store.state.dataUser?.userRoleIsAdmin;

    // Gọi hàm kéo dữ liệu lộ trình
    await loadRouteData();

    // Bắt thẻ con quét lại SQLite để đếm số ảnh offline mới nhất
    if (cardRoutePointsRef.value) {
        cardRoutePointsRef.value.loadOfflineQueue();
    }
});

onMounted(async () => {
    updateSystemTime();
    window.addEventListener('visibilitychange', handleAppWakeUp);
    window.addEventListener('focus', updateSystemTime);

    timer = setInterval(updateSystemTime, 5000);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
    window.removeEventListener('visibilitychange', handleAppWakeUp);
    window.removeEventListener('focus', updateSystemTime);
});

// ==========================================
// 5. CÁC HÀM TIỆN ÍCH KHÁC
// ==========================================
const confirmCancelRoute = () => {
    isCancelAlertOpen.value = true;
};

const isCancelling = ref(false);
const { pendingItems, loadPendingItems, removeQueueItem } = useOfflineManager();
const cancelButtons = [
    { text: t('routes.cancel'), role: 'cancel' },
    {
        text: t('routes.confirm-cancel'),
        role: 'confirm',
        cssClass: 'alert-button-confirm',
        handler: async () => {
            if (isCancelling.value) return false;
            isCancelling.value = true;
            try {
                const currentRoute = currentActiveRoute.value;
                if (!currentRoute) return;

                const removeData = {
                    routeId: currentRoute.routeId,
                    psId: currentRoute.psId,
                    updatedBy: store.state.dataUser?.userId,
                    isDeleteAction: true
                };

                await clearTimer(currentRoute.routeId);
                await loadPendingItems();

                const itemsToDelete = pendingItems.value.filter(
                    (item: any) => item.data.psId === currentRoute.psId
                );

                for (const item of itemsToDelete) {
                    // XÓA ẢNH VẬT LÝ TRƯỚC ---
                    if (item.imageFiles && item.imageFiles.length > 0) {
                        for (const fileName of item.imageFiles) {
                            await ImageService.deleteImage(fileName).catch(() => { });
                        }
                    }
                    // ------------------------------------

                    // Xóa Mock trong Vuex
                    store.commit('REMOVE_OFFLINE_REPORT', item.id);
                    // Xóa trong SQLite
                    await removeQueueItem(item.id);
                }

                try {
                    await PatrolShift.postRemovePatrolShift(removeData);
                } catch (error) {
                    // NẾU OFFLINE: Lưu lệnh xóa vào hàng chờ
                    try {
                        let deleteQueue = await storageService.get('offline_delete_queue');

                        if (!Array.isArray(deleteQueue)) {
                            deleteQueue = [];
                        }

                        const isExist = deleteQueue.some((item: any) => item.psId === removeData.psId);

                        if (!isExist) {
                            deleteQueue.push(removeData);
                            await storageService.set('offline_delete_queue', deleteQueue);
                            console.warn("Offline: Đã lưu lệnh xóa vào hàng chờ.");
                        }
                    } catch (storageErr) {
                        console.error("Lỗi parse dữ liệu từ Storage:", storageErr);
                        await storageService.set('offline_delete_queue', [removeData]);
                    }
                }

                // Reset và về Home
                await store.dispatch('resetCurrentRoute');
                shiftDataList.value = store.state.dataListRoute;
                router.replace('/home');
            } finally {
                isCancelling.value = false;
            }
        }
    }
];

useBackButton(10, () => {
    router.replace('/home');
});

watch(() => store.state.isSyncing, (isSyncingNow) => {
    // Khi isSyncing chuyển từ true -> false (nghĩa là vừa đồng bộ xong)
    if (!isSyncingNow && cardRoutePointsRef.value) {
        cardRoutePointsRef.value.loadOfflineQueue(); // Bắt đếm lại liền!
    }
});
</script>

<style scoped>
/* Thêm CSS cho Timer */
.timer-display {
    margin-top: 5px;
    font-size: 0.9rem;
    color: #666;
    transition: color 0.3s ease;
    display: flex;
    align-items: center;
}

.icon-clock {
    margin-right: 1px;
    font-size: 1.1rem;
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
    --ion-color-contrast: white !important;
    height: 50px;
    font-weight: bold;
    flex: 1;
    font-size: 20px;
}

/* No Route State */
.no-route-container {
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