<template>
    <ion-page>
        <ion-header>
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-back-button default-href="/home"></ion-back-button>
                </ion-buttons>
                <ion-title>
                    Route
                </ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-alert :is-open="isCancelAlertOpen" header="Cảnh báo!"
            message="Bạn có chắc chắn muốn hủy? Toàn bộ dữ liệu đã quét trong lộ trình này sẽ bị mất."
            :buttons="cancelButtons" @didDismiss="isCancelAlertOpen = false">
        </ion-alert>

        <ion-content>
            <div v-if="dataListRoute.length > 0">
                <ion-accordion-group :value="String(currentRouteId)" expand="inset">
                    <div v-for="route in dataListRoute" :key="route.routeId">
                        <ion-accordion :value="String(route.routeId)"
                            v-if="dataUser && route.areaId == dataUser.userAreaId"
                            :disabled="currentRouteId && currentRouteId != route.routeId">
                            <ion-item slot="header" color="light">
                                <ion-label>
                                    <strong class="route-name" :class="{
                                        'disable-routeId': currentRouteId && currentRouteId != route.routeId,
                                        'selected-routeId': currentRouteId && currentRouteId == route.routeId,
                                    }">{{ route.routeName }}</strong>
                                </ion-label>
                            </ion-item>
                            <div class="ion-padding inspection-grid-card" slot="content">
                                <ion-card-content>
                                    <div class="points-grid">
                                        <div v-for="(point, idx) in route.routeDetails" :key="point.rdId"
                                            class="grid-item-wrapper">
                                            <div class="point-node" :class="{
                                                'done': point.status === 1,
                                                'next-step': isNextRequired(route.routeDetails, idx)
                                            }">
                                                <div class="mini-thumb">
                                                    <ion-icon class="points-icon" :icon="libraryOutline"></ion-icon>
                                                    <div v-if="point.status === 1" class="check-icon">
                                                        <ion-icon :icon="checkmark"></ion-icon>
                                                    </div>
                                                </div>
                                                <span class="point-number">{{ idx + 1 }}</span>
                                            </div>
                                            <div v-if="(idx + 1) % 4 !== 0 && idx !== route.routeDetails.length - 1"
                                                class="h-line" :class="{ 'active': point.status === 1 }">
                                            </div>
                                            <div class="point-label">{{ point.cpName }}</div>
                                        </div>
                                    </div>

                                    <div class="route-actions-bar">
                                        <ion-button v-if="!currentRouteId" expand="block" color="primary"
                                            @click="handleRouteSelected(route.routeId, route.routeName)">
                                            <ion-icon slot="start" :icon="playOutline"></ion-icon>
                                            BẮT ĐẦU LỘ TRÌNH
                                        </ion-button>

                                        <div v-if="currentRouteId == route.routeId" class="active-controls">
                                            <ion-button fill="outline" color="danger" @click="confirmCancelRoute"
                                                class="btn-cancel">
                                                <ion-icon slot="start" :icon="trashOutline"></ion-icon>
                                                HỦY BỎ
                                            </ion-button>

                                            <ion-button color="success" @click="handleContinueScanning(route.routeId)"
                                                class="btn-continue">
                                                <ion-icon slot="start" :icon="qrCodeOutline"></ion-icon>
                                                QUÉT TIẾP
                                            </ion-button>
                                        </div>
                                    </div>
                                </ion-card-content>
                            </div>
                        </ion-accordion>
                    </div>
                </ion-accordion-group>
            </div>

            <div v-else class="ion-padding ion-text-center">
                <p>Đang tải dữ liệu lộ trình...</p>
            </div>

            <ion-alert :is-open="isAlertOpen" :header="`Bạn chọn ${nameRoute}?`" :buttons="alertButtons"
                @didDismiss="isAlertOpen = false"></ion-alert>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { scannerService } from '@/services/scanner.service';
import {
    IonPage, IonHeader, IonToolbar, IonTitle, IonIcon, IonButtons, IonBackButton,
    IonCardContent, IonContent, IonAccordion, IonAccordionGroup, IonItem, IonLabel,
    IonAlert, IonButton
} from '@ionic/vue';
import { checkmark, libraryOutline, qrCodeOutline, trashOutline, playOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';

const store = useStore();
const router = useRouter();
interface RouteDetail {
    rdId: number;
    cpId: number;
    cpName: string;
    status: number;
}

interface Route {
    routeId: number;
    routeName: string;
    routeDetails: RouteDetail[];
    areaId: number;
}

const nameRoute = ref();
const selectedRouteId = ref();

// Lấy dữ liệu an toàn từ store, mặc định là mảng rỗng nếu chưa có data
const dataListRoute = computed<Route[]>(() => store.state.dataListRoute);
console.log(dataListRoute);

const dataUser = computed(() => store.state.dataUser);
const isAlertOpen = ref(false);

// Lấy ID lộ trình đang thực hiện từ store
const currentRouteId = computed(() => store.state.routeId);

const handleRouteSelected = (id: number, name: string) => {
    console.log(id);
    selectedRouteId.value = id;
    nameRoute.value = name;
    isAlertOpen.value = true;
}

const handleContinueScanning = async (routeId: number) => {
    try {
        console.log("Đang khởi động trình quét cho route:", routeId);
        // Gọi service và đợi kết quả
        await scannerService.startScanning(store, router, routeId);
    } catch (error) {
        // Đây là nơi bạn "tóm" lỗi lại để không bị văng ra console
        console.error("Lỗi khi mở scanner:", error);

        // (Tùy chọn) Hiển thị thông báo cho người dùng biết
        // alert("Không thể mở máy ảnh. Vui lòng kiểm tra quyền truy cập.");
    }
};

const isNextRequired = (details: RouteDetail[], index: number) => {
    // Tìm điểm đầu tiên trong mảng có status !== 1
    const nextIndex = details.findIndex(p => p.status !== 1);
    return index === nextIndex;
}

const alertButtons = [
    {
        text: 'Cancel',
        role: 'cancel'
    },
    {
        text: 'OK',
        role: 'confirm',
        handler: () => {
            scannerService.startScanning(store, router, selectedRouteId.value);
        },
    },
];

// Thêm biến quản lý Alert Hủy
const isCancelAlertOpen = ref(false);

// Hàm mở cảnh báo
const confirmCancelRoute = () => {
    isCancelAlertOpen.value = true;
};

// Cấu hình các nút cho Alert
const cancelButtons = [
    {
        text: 'Đóng',
        role: 'cancel'
    },
    {
        text: 'Đồng ý hủy',
        role: 'confirm',
        cssClass: 'alert-button-confirm',
        handler: () => {
            // Gọi action trong store mà ta vừa viết ở trên
            store.dispatch('resetCurrentRoute');
        }
    }
];
</script>

<style scoped>
ion-toolbar {
    padding: 0 !important;
}

.inspection-grid-card {
    background-color: #FFF7ED;
    border-radius: 0 0 12px 12px;
    margin-bottom: 12px;
}

.points-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    /* Chia 4 cột cố định */
    gap: 15px 5px;
    /* Khoảng cách giữa các hàng và cột */
    padding: 10px 0;
}

.grid-item-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
}

.point-node {
    width: 45px;
    height: 45px;
    position: relative;
    border-radius: 10px;
    padding: 2px;
    border: 2px solid var(--ion-color-success);
    transition: all 0.3s;
}

.point-node.done {
    border-color: var(--ion-color-success);
}

.point-node.current {
    border-color: var(--ion-color-primary);
    transform: scale(1.1);
    box-shadow: 0 0 8px rgba(56, 128, 255, 0.4);
}

.points-icon {
    width: 80%;
    height: 100%;
}

.mini-thumb {
    text-align: center;
    width: 100%;
    height: 100%;
    border-radius: 6px;
    overflow: hidden;
    position: relative;
}

.mini-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.7;
}

.point-node.done img {
    opacity: 1;
}

.point-number {
    position: absolute;
    bottom: -6px;
    right: -6px;
    background: #666;
    color: white;
    font-size: 10px;
    padding: 2px 5px;
    border-radius: 10px;
    border: 1px solid white;
}

.point-node.current .point-number {
    background: var(--ion-color-primary);
}

/* Hiệu ứng nhấp nháy cho điểm cần quét tiếp theo */
.point-node.next-step {
    border-color: var(--ion-color-warning);
    border-style: dashed;
    animation: pulse-orange 2s infinite;
}

@keyframes pulse-orange {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.7);
        transform: scale(1);
    }

    70% {
        box-shadow: 0 0 0 10px rgba(255, 152, 0, 0);
        transform: scale(1.05);
    }

    100% {
        box-shadow: 0 0 0 0 rgba(255, 152, 0, 0);
        transform: scale(1);
    }
}

/* Mặc định Node chưa xong thì nên có màu xám nhẹ thay vì xanh success */
.point-node {
    width: 45px;
    height: 45px;
    position: relative;
    border-radius: 10px;
    padding: 2px;
    border: 2px solid #ddd;
    /* Đổi từ success sang xám */
    transition: all 0.3s;
    background: white;
}

/* Chỉ khi xong mới hiện viền xanh */
.point-node.done {
    border-color: var(--ion-color-success);
    border-style: solid;
}

.h-line {
    background: #ddd;
    /* Mặc định màu xám */
    position: absolute;
    top: 22px;
    right: -25%;
    width: 37%;
    height: 2px;
    z-index: 0;
    transition: background 0.5s;
}

/* Thêm class active cho đường nối */
.h-line.active {
    background: var(--ion-color-success);
}

.point-label {
    width: 100%;
    margin-top: 5px;
    font-size: 10px;
    text-align: center;
    color: #333;

    /* Line clamp logic */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    /* Hiển thị tối đa 2 dòng */
    overflow: hidden;
    line-height: 1.2;

    /* Đảm bảo từ dài không đẩy khung */
    word-wrap: break-word;
    white-space: normal;
}

.points-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px 8px;
    /* Tăng khoảng cách giữa các hàng */
    padding: 10px 5px;
}

ion-footer {
    padding: 10px;
    background: transparent;
}

ion-toolbar {
    --border-radius: 15px;
    box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.1);
}

/* Hiệu ứng nhấn cho nút footer */
.footer-scan-container:active {
    opacity: 0.7;
    transform: scale(0.98);
}

/* Làm mờ các lộ trình bị khóa */
ion-accordion[disabled] {
    opacity: 0.5;
    pointer-events: none;
    /* Ngăn chặn mọi tương tác click */
}

/* Nhấn mạnh lộ trình đang thực hiện */
ion-accordion:not([disabled]) .selected-routeId {
    color: var(--ion-color-success);
    font-weight: bold;
}

ion-accordion:not([disabled]) .disable-routeId {
    color: black;
}

.route-name {
    color: black;
}

/* Thêm badge "Đang thực hiện" vào tiêu đề lộ trình đang chạy (Tùy chọn) */
.active-badge {
    display: block;
    width: fit-content;
    --padding-start: 8px;
    --padding-end: 8px;
}

.route-actions-bar {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px dashed #ddd;
}

.active-controls {
    display: flex;
    gap: 10px;
    justify-content: space-between;
}

.active-controls ion-button {
    flex: 1;
    margin: 0;
    --border-radius: 8px;
    font-weight: bold;
    font-size: 13px;
}

.btn-cancel {
    --border-width: 1.5px;
}

/* Hiệu ứng cho nút bắt đầu */
.route-actions-bar ion-button[expand="block"] {
    --border-radius: 8px;
    height: 45px;
    font-weight: bold;
}

/* Chỉnh lại padding của card content để không bị chật */
.inspection-grid-card ion-card-content {
    padding: 15px 10px;
}
</style>