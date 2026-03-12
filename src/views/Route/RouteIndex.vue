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

                <div v-else :key="'none-' + currentHour" class="ion-padding ion-text-center no-route-container">
                    <div class="no-route-content">
                        <div v-if="userRoleIsAdmin && shiftDataList">
                            <ion-icon :icon="calendarOutline" class="big-icon"></ion-icon>
                            <h3>Bạn không có lộ trình phù hợp</h3>
                        </div>
                        <div v-else class="no-route-content">
                            <ion-icon :icon="calendarOutline" class="big-icon"></ion-icon>
                            <h3>{{ !shiftDataList ? 'Không có lộ trình' : `Lộ trình ${currentHour}h đã hoàn thành` }}
                            </h3>
                            <p>Hiện không có lộ trình nào cần thực hiện vào khung giờ <strong>{{ currentHour
                            }}h</strong>.</p>
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
    IonCardSubtitle, IonCardTitle, IonSpinner, onIonViewWillEnter
} from '@ionic/vue';
import { qrCodeOutline, calendarOutline, trashOutline, timeOutline } from 'ionicons/icons';
import CardRoutePoints from '@/components/CardRoutePoints.vue';
import { scannerService } from '@/services/scanner.service';

import PatrolShiftView from '@/api/PatrolShiftView';

// IMPORT GLOBAL TIMER
import { useRouteTimer } from '@/composables/useRouteTimer';

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

// ==========================================
// 1. KHAI BÁO LỘ TRÌNH HIỆN TẠI
// ==========================================
const currentActiveRoute = computed<Route | null>(() => {
    const routes = shiftDataList.value;
    const userData = store.state.dataUser;

    if (!Array.isArray(routes) || !userData) return null;

    const uRole = Number(userData.userRoleId);
    const uArea = Number(userData.userAreaId);
    const hNow = currentHour.value;

    const foundRoute = routes.find((r: Route) => {
        if (Number(r.areaId) !== uArea || Number(r.roleId) !== uRole) return false;

        const isStarted = r.routeDetails.some(p => p.status === 1);
        const isFinished = r.routeDetails.every(p => p.status === 1);

        if (isStarted && !isFinished) {
            return true;
        }

        const isMatchHour = hNow >= Number(r.psHourFrom) && hNow <= Number(r.psHourTo);
        const isNotCompleted = !r.isComplete && !isFinished;

        return isMatchHour && isNotCompleted;
    });

    if (foundRoute) {
        store.commit('SET_PSID', foundRoute.psId);
    }

    return foundRoute ? { ...foundRoute } : null;
});

// ==========================================
// 2. KHÔI PHỤC TIMER KHI RELOAD
// ==========================================
// Ngay khi load được routeId, tự động gọi hàm restoreTimer để lục trong SQLite xem có giờ đang chạy dở không
watch(() => currentActiveRoute.value?.routeId, async (newId) => {
    if (newId) {
        await restoreTimer(newId);
    }
}, { immediate: true });

// ==========================================
// 3. CÁC HÀM XỬ LÝ API VÀ LIFECYCLE VUE
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

    if (!store.state.isHydrated) {
        await store.dispatch('initApp');
    }

    updateSystemTime();

    const areaId = store.state.dataUser?.userAreaId;
    userRoleIsAdmin.value = store.state.dataUser?.userRoleIsAdmin;

    const now = new Date();
    const dateInfo = {
        psDay: now.getDate(),
        psMonth: now.getMonth() + 1,
        psYear: now.getFullYear(),
        psHour: now.getHours(),
        isComplete: false,
        areaId: areaId
    };

    try {
        if (navigator.onLine) {
            const response: any = await PatrolShiftView.postPatrolShiftView(dateInfo);
            const responseData = response?.data;
            let apiData: any[] = [];

            if (Array.isArray(responseData)) {
                apiData = responseData;
            } else if (responseData && Array.isArray(responseData.data)) {
                apiData = responseData.data;
            } else if (responseData?.data && Array.isArray(responseData.data.data)) {
                apiData = responseData.data.data;
            }

            const localRoutes = store.state.dataListRoute || [];

            apiData = apiData.map((apiRoute: any) => {
                const localRoute = localRoutes.find((r: any) => r.routeId === apiRoute.routeId);
                if (localRoute && localRoute.routeDetails && apiRoute.routeDetails) {
                    apiRoute.routeDetails = apiRoute.routeDetails.map((apiPoint: any) => {
                        const localPoint = localRoute.routeDetails.find((p: any) => p.cpId === apiPoint.cpId);
                        if (localPoint && localPoint.status === 1) {
                            apiPoint.status = 1;
                        }
                        return apiPoint;
                    });
                }
                return apiRoute;
            });

            shiftDataList.value = apiData;
            store.commit('SET_DATA_LIST_ROUTE', shiftDataList.value);
        } else {
            shiftDataList.value = store.state.dataListRoute || [];
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu ca trực:", error);
        shiftDataList.value = store.state.dataListRoute || [];
    } finally {
        isLoading.value = false;
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

const handleContinueScanning = async (routeId: number) => {
    if (isScanning.value) return;
    isScanning.value = true;
    try {
        await scannerService.startScanning(store, router, routeId);
    } catch (error) {
        console.error("Lỗi scanner:", error);
    } finally {
        isScanning.value = false;
    }
};

const confirmCancelRoute = () => {
    isCancelAlertOpen.value = true;
};

const cancelButtons = [
    { text: 'Đóng', role: 'cancel' },
    {
        text: 'Đồng ý hủy',
        role: 'confirm',
        cssClass: 'alert-button-confirm',
        handler: () => {
            if (currentActiveRoute.value) {
                clearTimer(currentActiveRoute.value.routeId);
            }
            store.dispatch('resetCurrentRoute');
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