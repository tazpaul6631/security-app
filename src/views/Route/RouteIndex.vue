<template>
    <ion-page>
        <ion-header>
            <ion-toolbar class="none-padding">
                <ion-buttons slot="start">
                    <ion-back-button default-href="/home"></ion-back-button>
                </ion-buttons>
                <ion-title>Routes</ion-title>
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
                                <span class="timer-display" :class="timerColorClass" v-if="formattedTime">
                                    <ion-icon class="icon-clock" :icon="timeOutline"></ion-icon>
                                    Thời gian: {{ formattedTime }}
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
import presentAlert from '@/mixins/presentAlert';
import { Geolocation } from '@capacitor/geolocation';

// IMPORT GLOBAL TIMER
import { useRouteTimer } from '@/composables/useRouteTimer';
import PatrolShift from '@/api/PatrolShift';
import { useOfflineManager } from '@/composables/useOfflineManager';

// Lấy biến và hàm từ Global Timer ra sử dụng
const { formattedTime, timerColorClass, clearTimer, restoreTimer, stopTimer, remainingSeconds, currentTimerRouteId } = useRouteTimer();

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

    // THÊM DÒNG NÀY: Lấy thêm psId đang bị khóa từ Store
    const lockedPsId = store.state.psId;

    if (!userData || !Array.isArray(routes)) return null;

    const uRole = Number(userData.userRoleId);
    const uArea = Number(userData.userAreaId);
    const hNow = currentHour.value;

    // ƯU TIÊN 1: Lộ trình đang làm dở (Locked) - Dù quá giờ vẫn phải hiện ca này
    if (lockedRouteId.value !== null) {

        // SỬA Ở ĐÂY: Tìm CHÍNH XÁC cả 2 điều kiện
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
            const isFinished = lockedRoute.routeDetails.every((p: any) => p.status === 1);
            if (!isFinished) return { ...lockedRoute };
        }
    }

    // ƯU TIÊN 2: Tìm lộ trình mới theo khung giờ hiện tại
    const foundRoute = routes.find((r: any) => {
        if (Number(r.areaId) !== uArea || Number(r.roleId) !== uRole) return false;

        const f = Number(r.psHourFrom);
        const t = Number(r.psHourTo);
        let isMatchHour = false;

        // SỬA Ở ĐÂY: Xử lý ca trong ngày và ca qua đêm
        if (f <= t) {
            isMatchHour = hNow >= f && hNow <= t;
        } else {
            // Ca qua đêm (Ví dụ 21h tối đến 6h sáng)
            isMatchHour = hNow >= f || hNow <= t;
        }

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
        store.commit('SET_PSID', newRoute.psId);
        storageService.set('current_ps_id', newRoute.psId);
    }

    if (newRoute) {
        // 1. Kiểm tra xem ca này đã có điểm nào quét chưa (status = 1)
        const hasStarted = newRoute.routeDetails.some((p: any) => p.status === 1);

        // 2. Hoặc kiểm tra xem nó có đang bị khóa dở dang không
        const isUnfinished = Number(newRoute.routeId) === Number(lockedRouteId.value);

        // CHỈ KHÔI PHỤC NẾU THỰC SỰ ĐÃ BẮT ĐẦU LÀM
        if (hasStarted || isUnfinished) {
            await restoreTimer(newRoute.routeId);
        } else {
            // NẾU CA MỚI TINH (Chưa làm gì): Đảm bảo timer phải dừng và sạch sẽ
            if (remainingSeconds.value > 0 || currentTimerRouteId !== null) {
                await clearTimer(newRoute.routeId);
            }
        }
    } else {
        // Nếu không có lộ trình nào hoạt động, cũng dọn dẹp luôn
        stopTimer();
        remainingSeconds.value = 0;
        currentTimerRouteId.value = null;
    }
}, { immediate: true });

// ==========================================
// 3. CÁC HÀM XỬ LÝ QUÉT MÃ (Sắp xếp lên trên)
// ==========================================
// Hàm xử lý kết quả quét chung (Cả Camera và Unitech đều gọi hàm này)
const processScannedData = async (qrCodeString: string, routeId: number, locationData: any) => {
    if (!qrCodeString) return;

    // 1. Khởi tạo Loading
    const loading = await loadingController.create({
        message: 'Đang kiểm tra điểm quét...',
        spinner: 'crescent',
        cssClass: 'custom-loading' // Nếu bạn muốn style riêng
    });

    await loading.present();

    try {
        // Gọi logic xử lý nặng (Check lộ trình, API, SQLite)
        await scannerService.processQRString(store, router, routeId, qrCodeString, locationData);

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

const handleHardwareScan = async (e: KeyboardEvent) => {
    if (store.state.isSyncing) return;
    if (e.key === 'Enter') {
        if (scanBuffer.length > 3 && currentActiveRoute.value) {
            const bufferCopy = scanBuffer;
            scanBuffer = '';

            const locData = await checkLocationReady();
            if (!locData) return;

            processScannedData(bufferCopy, currentActiveRoute.value.routeId, locData);
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
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
    if (isScanning.value) return;

    isScanning.value = true; // Khóa nút bấm ngay lập tức để tránh bấm đúp

    try {
        const result: any = await scannerService.startScanning(store, router, routeId);

        // Nếu user bấm dấu X, kết quả thường trả về null hoặc undefined (không nhảy vào catch)
        if (result && typeof result === 'string') {
            const locData = await checkLocationReady();
            if (!locData) return;
            await processScannedData(result, routeId, locData);
        }
    } catch (error: any) {
        console.error("Lỗi scanner:", error);

        // Chuyển lỗi về dạng chuỗi để check cho dễ
        const errString = String(error).toLowerCase();
        const errMessage = error?.message ? String(error.message).toLowerCase() : '';

        // Danh sách các từ khóa xác định là User chủ động tắt Camera
        const userClosedCamera =
            errString.includes('cancel') ||
            errMessage.includes('cancel') ||
            errString.includes('closed') ||
            errMessage.includes('closed');

        // CHỈ HIỆN CẢNH BÁO nếu không phải do user tắt, và lỗi liên quan đến phần cứng/quyền
        // Máy Unitech khi gọi startScanning thường báo lỗi: "Hardware not available" hoặc "Permission denied"
        if (!userClosedCamera) {
            await presentAlert.presentAlert(
                'Lưu ý thiết bị',
                '',
                'Để quét mã trên thiết bị này, vui lòng bấm nút cứng (vật lý) bên hông hoặc đầu máy!',
                'custom-alert-class'
            );
        }
    } finally {
        isScanning.value = false;
    }
};

const hasDataButFinished = computed(() => {
    const routes = shiftDataList.value;
    if (!Array.isArray(routes)) return false;

    // Tìm xem có ca trực nào khớp với giờ hiện tại không
    const routeInHour = routes.find(r => {
        const f = Number(r.psHourFrom);
        const t = Number(r.psHourTo);
        // SỬA Ở ĐÂY TƯƠNG TỰ
        if (f <= t) {
            return currentHour.value >= f && currentHour.value <= t;
        } else {
            return currentHour.value >= f || currentHour.value <= t;
        }
    });

    if (routeInHour) {
        return routeInHour.routeDetails.every(p => p.status === 1);
    }
    return false;
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
    (window as any).returnResult = async (data: any) => {
        if (currentActiveRoute.value && data) {

            const locData = await checkLocationReady();
            if (!locData) return;

            let qrString = typeof data === 'string' ? data : JSON.stringify(data);
            processScannedData(qrString, currentActiveRoute.value.routeId, locData);
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

const isCancelling = ref(false);
const cancelButtons = [
    { text: 'Đóng', role: 'cancel' },
    {
        text: 'Đồng ý hủy',
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

                console.log(removeData);

                await clearTimer(currentRoute.routeId);
                const { pendingItems, loadPendingItems, removeQueueItem } = useOfflineManager();
                await loadPendingItems();

                const itemsToDelete = pendingItems.value.filter(
                    (item: any) => item.data.psId === currentRoute.psId
                );
                for (const item of itemsToDelete) {
                    // Xóa Mock trong Vuex
                    store.commit('REMOVE_OFFLINE_REPORT', item.id);
                    // Xóa trong SQLite
                    await removeQueueItem(item.id);
                }

                try {
                    await PatrolShift.postRemovePatrolShift(removeData);
                } catch (error) {
                    // NẾU OFFLINE: Kiểm tra xem đã có psId này trong hàng chờ chưa trước khi push
                    const deleteQueue = (await storageService.get('offline_delete_queue')) || [];
                    const isExist = deleteQueue.some((item: any) => item.psId === removeData.psId);

                    if (!isExist) {
                        deleteQueue.push(removeData);
                        await storageService.set('offline_delete_queue', deleteQueue);
                        console.warn("Offline: Đã lưu lệnh xóa vào hàng chờ.");
                    }
                }

                await store.dispatch('resetCurrentRoute');
                shiftDataList.value = store.state.dataListRoute;
                router.replace('/home');
            } finally {
                isCancelling.value = false; // Mở khóa khi xong
            }
        }
    }
];

// ==========================================
// KIỂM TRA ĐỊNH VỊ (GPS)
// ==========================================
const checkLocationReady = async (): Promise<any | null> => {
    try {
        let perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
            perm = await Geolocation.requestPermissions();
        }
        if (perm.location !== 'granted') {
            await presentAlert.presentAlert('Cảnh báo', '', 'Bạn cần cấp quyền vị trí để đi tuần tra.');
            return null; // Trả về null nếu thất bại
        }

        const position = await Geolocation.getCurrentPosition({
            timeout: 15000,
            enableHighAccuracy: true,
            maximumAge: 10000
        });

        // TRẢ VỀ DATA TỌA ĐỘ THAY VÌ LƯU VUEX TẠI ĐÂY
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
        };
    } catch (error: any) {
        console.error("Lỗi GPS:", error);
        await presentAlert.presentAlert(
            'Chưa bật Định vị',
            '',
            'Vui lòng BẬT ĐỊNH VỊ (GPS) trên điện thoại trước khi quét mã!'
        );
        return null;
    }
};
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