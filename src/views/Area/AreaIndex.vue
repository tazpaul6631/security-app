<template>
    <ion-page>
        <ion-header>
            <ion-toolbar class="none-padding">
                <ion-buttons slot="start">
                    <ion-back-button default-href="/home"></ion-back-button>
                </ion-buttons>
                <ion-title>Area</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content>
            <div slot="fixed" style="width: 100%; background: var(--ion-background-color, #fff); z-index: 10;">
                <ion-segment :value="activeSegment" mode="md">
                    <ion-segment-button v-for="([parent, children, id]) in datalistNav" :key="parent" :value="parent"
                        @click="openSelect(parent, children, id)">
                        <ion-label>{{ parent }} ▾</ion-label>
                    </ion-segment-button>
                </ion-segment>
            </div>

            <ion-modal :is-open="isModalOpen" @didDismiss="isModalOpen = false" :initial-breakpoint="0.5"
                :breakpoints="[0, 0.5, 0.8]">
                <ion-header>
                    <ion-toolbar>
                        <ion-title>Chọn {{ activeSegment }}</ion-title>
                        <ion-buttons slot="end">
                            <ion-button @click="isModalOpen = false">Đóng</ion-button>
                        </ion-buttons>
                    </ion-toolbar>
                    <ion-progress-bar v-show="isLoading" type="indeterminate" color="primary"></ion-progress-bar>
                </ion-header>

                <ion-content class="ion-padding">
                    <ion-list v-if="currentOptions.length > 0" lines="full">
                        <ion-item v-for="(item, index) in currentOptions" :key="item.psId || item.routeId || index"
                            :button="true" @click="handleModalSelection(item)">
                            <ion-grid>
                                <ion-row class="ion-align-items-center">
                                    <ion-col>
                                        <ion-label>
                                            <strong
                                                :style="(item.isOfflineDone || item.realityPoint > 0) ? 'color: var(--ion-color-primary)' : ''">
                                                {{ item.routeCode }}
                                            </strong>
                                            <p style="font-size: 0.9em; color: var(--ion-color-step-600);">{{
                                                item.routeName }}</p>

                                            <div v-if="item.isOfflineDone">
                                                <ion-badge color="warning" mode="ios" style="font-size: 0.7em;">
                                                    Chờ đồng bộ server
                                                </ion-badge>
                                            </div>

                                            <div style="margin-top: 5px;">
                                                <ion-icon class="icon-1" :icon="newspaperOutline"
                                                    :color="item.pointProblem ? 'danger' : 'success'">
                                                </ion-icon>
                                                <ion-icon class="icon-2" :icon="timeOutline"
                                                    :color="item.timeProblem ? 'danger' : 'success'">
                                                </ion-icon>
                                                <ion-icon class="icon-2" :icon="footstepsOutline"
                                                    :color="item.shiftProblem ? 'danger' : 'success'">
                                                </ion-icon>
                                            </div>
                                            <div>
                                                <ion-label class="labelItem" color="medium">{{
                                                    item.shiftStart.replace('T', ' ').slice(0, 16) }}</ion-label>
                                            </div>
                                        </ion-label>
                                    </ion-col>

                                    <ion-col size="6" class="ion-text-end">
                                        <div class="note-container">
                                            <ion-label class="labelItem" color="medium">{{ item.reportName || 'Tuần tra'
                                                }}</ion-label>

                                            <ion-badge
                                                :color="item.realityPoint >= item.planPoint ? 'success' : 'medium'"
                                                style="margin-top: 4px; color: white;">
                                                {{ item.realityPoint || 0 }}/{{ item.planPoint || 0 }} điểm
                                            </ion-badge>

                                            <p v-if="item.realityHours || item.realityMinutes"
                                                style="font-size: 0.75em; margin: 4px 0 0 0;">
                                                <ion-icon :icon="timeOutline" style="font-size: 10px;"></ion-icon>
                                                {{ item.realityHours ? `${item.realityHours}h` : '' }}
                                                {{ item.realityMinutes ? `${item.realityMinutes}m` : '' }}
                                                {{ item.realitySeconds ? `${item.realitySeconds}s` : '' }}
                                            </p>
                                        </div>
                                        <div>
                                            <ion-label class="labelItem" color="medium">{{
                                                item.shiftEnd.replace('T', ' ').slice(0, 16) }}</ion-label>
                                        </div>
                                    </ion-col>
                                </ion-row>
                            </ion-grid>
                        </ion-item>
                    </ion-list>

                    <div v-else-if="!isLoading" class="ion-padding ion-text-center">
                        <ion-icon :icon="calendarOutline" style="font-size: 64px; color: #ccc;"></ion-icon>
                        <p>Danh sách chưa có</p>
                    </div>
                </ion-content>
            </ion-modal>

            <div class="list-container" style="margin-top: 50px;">
                <ion-list v-if="isLoading">
                    <ion-item v-for="i in 5" :key="i">
                        <ion-grid>
                            <ion-row class="ion-align-items-center">
                                <ion-col size="auto">
                                    <ion-skeleton-text animated
                                        style="width: 24px; height: 24px; border-radius: 50%;"></ion-skeleton-text>
                                </ion-col>
                                <ion-col>
                                    <ion-skeleton-text animated style="width: 70%; height: 16px;"></ion-skeleton-text>
                                </ion-col>
                            </ion-row>
                        </ion-grid>
                    </ion-item>
                </ion-list>

                <div v-else-if="displayedItems.length === 0" class="ion-padding ion-text-center no-route-container">
                    <ion-icon :icon="calendarOutline" style="font-size: 64px; color: #ccc;"></ion-icon>
                    <p>Danh sách trống: <strong style="color: red;">
                            Vui lòng chọn lộ trình
                        </strong></p>
                    <ion-button fill="outline" @click="router.replace('/home')" class="ion-margin-top">
                        Quay lại trang chủ
                    </ion-button>
                </div>

                <ion-list v-else>
                    <ion-item v-for="item in displayedItems" :key="item.prId" :button="true"
                        @click="handleSelectedRow(Number(item.prId))"
                        :class="item.prHasProblem ? 'custom-item-false' : 'custom-item-true'">
                        <ion-grid>
                            <ion-row class="ion-align-items-center">
                                <ion-col size="auto">
                                    <ion-icon :icon="newspaperOutline"
                                        :color="item.prHasProblem ? 'danger' : 'success'"></ion-icon>
                                </ion-col>
                                <ion-col>
                                    <ion-label>
                                        <strong>{{ item.cpName }}</strong>
                                        <ion-text color="warning" v-if="item.isOfflineMock"
                                            style="font-size: 0.8em; display: block;">
                                            <ion-text color="danger">* </ion-text> Đang chờ đồng bộ...
                                        </ion-text>
                                    </ion-label>
                                </ion-col>
                                <ion-col class="ion-text-end">
                                    <ion-label class="labelItem">{{ item.reportName }}</ion-label>
                                    <ion-note class="labelItem">{{ item.reportAt?.replace('T', ' ').slice(0, 16)
                                    }}</ion-note>
                                </ion-col>
                            </ion-row>
                        </ion-grid>
                    </ion-item>
                </ion-list>

                <ion-infinite-scroll ref="infiniteScrollRef" @ionInfinite="loadMoreData($event)"
                    :disabled="isInfiniteDisabled">
                    <ion-infinite-scroll-content loading-text="Đang tải thêm..."
                        loading-spinner="bubbles"></ion-infinite-scroll-content>
                </ion-infinite-scroll>
            </div>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import PointReport from '@/api/PointReport';
import router from '@/router';
import {
    IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonLabel,
    IonSegment, IonSegmentButton, IonContent, IonIcon, IonGrid, IonRow, IonCol,
    IonText, IonNote, loadingController, IonItem, IonList,
    onIonViewWillEnter, IonProgressBar, IonSkeletonText, IonInfiniteScroll,
    IonInfiniteScrollContent, IonButton, IonModal, IonBadge
} from '@ionic/vue';
import { calendarOutline, footstepsOutline, newspaperOutline, timeOutline } from "ionicons/icons";
import { computed, ref, watch } from 'vue';
import { useStore } from 'vuex';
import presentAlert from '@/mixins/presentAlert';
import AreaBU from '@/api/AreaBU';
import storageService from '@/services/storage.service';

const store = useStore();

// --- STATE ---
const currentOptions = ref<any[]>([]);
const activeSegment = ref<string>('');
const selectedItem = ref<any>(null);
const isModalOpen = ref(false);
const isLoading = ref(false);
const currentPage = ref(1);
const displayedItems = ref<any[]>([]);
const isInfiniteDisabled = ref(false);
const itemsPerPage = 15;

const isOnline = computed(() => store.state.isOnline);

// --- 1. COMPUTED DATA ---
const datalistNav = computed(() => {
    const rawData = store.state.dataAreaBU;
    const areas = Array.isArray(rawData) ? rawData : (rawData?.data || []);
    const result: [string, any[], number][] = [];

    const userInfo = store.state.dataUser?.data || store.state.dataUser || {};
    const isAdmin = userInfo.userRoleIsAdmin === true;
    const userAreaId = userInfo.userAreaId;

    for (const item of areas) {
        // Chỉ check quyền xem Area, KHÔNG lọc patrolShifts ở đây
        const isAuthorizedArea = isAdmin || (item.areaId === userAreaId);

        if (isAuthorizedArea) {
            // Trả về toàn bộ ca của Area đó (việc lọc sẽ làm ở Modal)
            result.push([item.areaCode, item.patrolShifts || [], item.areaId]);
        }
    }
    return result;
});

const dataPR = computed(() => {
    if (!selectedItem.value) return { details: [] };

    const dataStore = store.state.dataListCP;
    let listDetails = [];
    if (Array.isArray(dataStore) && dataStore.length > 0) {
        listDetails = dataStore[0]?.data || dataStore;
    } else {
        listDetails = dataStore?.data || [];
    }

    const safeList = Array.isArray(listDetails) ? listDetails : [];

    return {
        details: safeList.map((item: any) => ({
            prId: item.prId,
            cpName: item.cpName || item.cpCode,
            createdName: item.createdName,
            createdAt: item.createdAt || '',
            prHasProblem: item.prHasProblem,
            isOfflineMock: item.isOfflineMock || false,
            reportName: item.reportName || 'Báo cáo tuần tra',
            reportAt: item.createdAt
        }))
    };
});

// --- 2. WATCHERS ---
watch(() => dataPR.value.details, (newVal) => {
    if (currentPage.value === 1) {
        displayedItems.value = newVal.slice(0, itemsPerPage);
    } else {
        const currentCount = displayedItems.value.length;
        displayedItems.value = newVal.slice(0, Math.max(currentCount, itemsPerPage));
    }
    isInfiniteDisabled.value = displayedItems.value.length >= newVal.length;
}, { deep: true, immediate: true });

// --- 3. METHODS CHÍNH (GỌI API THEO ĐIỀU KIỆN) ---
const fetchAreasData = async (areaId: number) => {
    isLoading.value = true;
    const userInfo = store.state.dataUser?.data || store.state.dataUser || {};
    const currentUserId = userInfo.userId;
    const isAdmin = userInfo.userRoleIsAdmin === true;

    try {
        if (isOnline.value) {
            // Gửi userId lên để Server lọc (nếu Server có hỗ trợ)
            const payload: any = { areaId: areaId, reportBy: currentUserId };
            if (!isAdmin) payload.userId = currentUserId;

            const response = await AreaBU.postAreaBU(payload);
            const fetchedAreas = Array.isArray(response?.data) ? response.data : (response?.data?.data || []);

            // Sau khi lấy về, lọc lại 1 lần nữa ở Client cho chắc chắn
            const foundArea = fetchedAreas.find((item: any) => item.areaId === areaId);
            let shifts = foundArea ? (foundArea.patrolShifts || []) : [];

            if (!isAdmin) {
                shifts = shifts.filter((s: any) => String(s.reportBy) === String(currentUserId));
            }
            currentOptions.value = shifts;

        } else {
            // OFFLINE: Lấy từ Store nhưng lọc gắt gao theo reportBy
            const rawData = store.state.dataAreaBU;
            let areas = Array.isArray(rawData) ? rawData : (rawData?.data || []);

            const foundArea = areas.find((item: any) => Number(item.areaId) === Number(areaId));
            let shifts = foundArea ? (foundArea.patrolShifts || []) : [];

            // LỌC CHỐT HẠ: Người 2 sẽ không thấy ca của người 1 ở đây
            if (!isAdmin) {
                shifts = shifts.filter((s: any) => String(s.reportBy) === String(currentUserId));
            }
            currentOptions.value = shifts;
        }
    } catch (error) {
        console.error("Lỗi:", error);
        currentOptions.value = [];
    } finally {
        isLoading.value = false;
    }
};

const initDefaultTab = async () => {
    if (datalistNav.value.length > 0) {
        const firstTab = datalistNav.value[0];
        activeSegment.value = firstTab[0];
        const firstAreaId = firstTab[2];

        isModalOpen.value = true;
        await fetchAreasData(firstAreaId);
    }
};

onIonViewWillEnter(async () => {
    if (!selectedItem.value) {
        await initDefaultTab();
    }
});

const openSelect = async (parent: string, children: any[], id: number) => {
    activeSegment.value = parent;
    isModalOpen.value = true;
    displayedItems.value = [];
    currentOptions.value = [];
    await fetchAreasData(id);
};

// --- CÁC METHODS XỬ LÝ CHỌN LỘ TRÌNH ---
const handleModalSelection = async (item: any) => {
    isModalOpen.value = false;
    currentPage.value = 1;

    const userInfo = store.state.dataUser?.data || store.state.dataUser || {};
    const currentUserId = Number(userInfo.userId);
    const isAdmin = userInfo.userRoleIsAdmin === true;

    setTimeout(async () => {
        isLoading.value = true;
        selectedItem.value = [item.routeName, item.routeId];

        try {
            let finalReports = [];

            // --- CHẾ ĐỘ ONLINE ---
            if (isOnline.value) {
                try {
                    const responseBU = await PointReport.postBasePointReportView(item.psId);
                    finalReports = Array.isArray(responseBU?.data) ? responseBU.data : (responseBU?.data?.data || []);
                    // const apiData = Array.isArray(responseBU?.data) ? responseBU.data : (responseBU?.data?.data || []);

                    // // Lọc lại một lần nữa ở Client cho chắc chắn
                    // finalReports = isAdmin ? apiData : apiData.filter((r: any) => String(r.reportBy) === String(currentUserId));
                } catch (e) {
                    console.warn("API lỗi, chuyển sang Offline data.");
                }
            }

            // --- CHẾ ĐỘ OFFLINE (Hoặc khi Online không có data) ---
            if (finalReports.length === 0) {
                const baseReports = Array.isArray(store.state.dataBasePointReportView)
                    ? store.state.dataBasePointReportView
                    : (store.state.dataBasePointReportView?.data || []);

                const recentReports = Array.isArray(store.state.dataCheckpointsId)
                    ? store.state.dataCheckpointsId
                    : (store.state.dataCheckpointsId?.data || []);

                const combined = [...recentReports, ...baseReports];

                // LỌC OFFLINE THEO psId VÀ userId (reportBy)
                finalReports = combined.filter((rep: any) => {
                    const isRightShift = Number(rep.psId) === Number(item.psId);
                    const isRightUser = isAdmin || Number(rep.reportBy) === currentUserId || Number(rep.userId) === currentUserId;
                    return isRightShift && isRightUser;
                });

                // Khử trùng theo cpId
                const uniqueMap = new Map();
                finalReports.forEach(r => {
                    if (uniqueMap.has(r.cpId) && !r.isOfflineMock) return;
                    uniqueMap.set(r.cpId, r);
                });
                finalReports = Array.from(uniqueMap.values());
            }

            // Sắp xếp và xử lý Thumbnail (giữ nguyên logic cũ của bạn)
            finalReports.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            store.commit('SET_DATACP', [{ data: finalReports }]);
        } catch (error) {
            console.error("Lỗi:", error);
        } finally {
            isLoading.value = false;
        }
    }, 300);
};

const handleSelectedRow = async (prId: number) => {
    console.log("Đang mở chi tiết PR_ID:", prId);

    const loading = await loadingController.create({
        message: 'Đang tải chi tiết...',
        spinner: 'crescent'
    });

    try {
        await loading.present();
        let detailData = null;
        let found = null;

        // ==========================================
        // LỚP 1: TÌM TRONG RAM (VUEX) - Cực nhanh
        // ==========================================
        // 1.1 Tìm trong danh sách báo cáo vừa quét/mock
        const recentVuex = Array.isArray(store.state.dataCheckpointsId)
            ? store.state.dataCheckpointsId
            : (store.state.dataCheckpointsId?.data || []);
        found = recentVuex.find((rep: any) => String(rep.prId) === String(prId));

        // 1.2 Tìm trong danh sách base (ca trực)
        if (!found) {
            const baseVuex = Array.isArray(store.state.dataBasePointReportView)
                ? store.state.dataBasePointReportView
                : (store.state.dataBasePointReportView?.data || []);
            found = baseVuex.find((rep: any) => String(rep.prId) === String(prId));
        }

        // ==========================================
        // LỚP 2: TÌM TRONG Ổ CỨNG (SQLITE) - Nhanh hơn gọi mạng
        // ==========================================
        if (!found) {
            // 2.1 Tìm trong kho checkpoints_id
            const recentDbRaw = await storageService.get('checkpoints_id');
            const recentDb = Array.isArray(recentDbRaw) ? recentDbRaw : (recentDbRaw?.data || []);
            found = recentDb.find((rep: any) => String(rep.prId) === String(prId));
        }

        if (!found) {
            // 2.2 Tìm trong kho base_point_report
            const baseDbRaw = await storageService.get('base_point_report');
            const baseDb = Array.isArray(baseDbRaw) ? baseDbRaw : (baseDbRaw?.data || []);
            found = baseDb.find((rep: any) => String(rep.prId) === String(prId));
        }

        // ==========================================
        // LỚP 3: ĐƯỜNG CÙNG MỚI GỌI API (Tải Base64 nặng nề)
        // ==========================================
        if (found) {
            console.log("✅ Đã tìm thấy data dưới Local (Vuex/SQLite)");
            detailData = { data: found };
        } else if (isOnline.value) {
            console.log("⚠️ Không có dưới Local, bắt buộc kéo API từ Server...");
            const res = await PointReport.getPointReportId(prId);
            if (res?.data) detailData = res.data;
        }

        // Kiểm tra chốt hạ
        if (!detailData?.data) {
            throw new Error("No data");
        }

        // Đẩy data vào store và chuyển trang
        store.commit('SET_CURRENT_CHECKPOINT', detailData);
        router.push({ path: `/checkpoint/detail/${prId}` });

    } catch (error) {
        console.error("Lỗi mở chi tiết báo cáo:", error);
        presentAlert.presentAlert('Thông báo', '', 'Không tìm thấy dữ liệu chi tiết.');
    } finally {
        await loading.dismiss();
    }
};

const loadMoreData = (event: any) => {
    setTimeout(() => {
        const nextStartIndex = currentPage.value * itemsPerPage;
        const nextEndIndex = nextStartIndex + itemsPerPage;
        const nextBatch = dataPR.value.details.slice(nextStartIndex, nextEndIndex);

        if (nextBatch.length > 0) {
            displayedItems.value.push(...nextBatch);
            currentPage.value++;
        }

        event.target.complete();
        if (displayedItems.value.length >= dataPR.value.details.length) {
            isInfiniteDisabled.value = true;
        }
    }, 500);
};
</script>

<style scoped>
.pointProblem-danger,
.timeProblem-danger {
    color: #eb445a;
}

.pointProblem-success,
.timeProblem-success {
    color: #2dd36f;
}

.labelItem-time {
    font-size: 10px;
    display: block;
}

.labelItem {
    font-size: 0.9em;
    display: block;
}

ion-segment {
    margin-bottom: 5px;
}

.icon-1 {
    padding: 0 2px 0 0;
}

.icon-2 {
    padding: 0 2px 0 2px;
}

/* AreaIndex.vue */

.labelItem {
    font-size: 0.85em;
    display: block;
    line-height: 1.4;
}

.note-container {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
}

/* Định dạng các icon trạng thái */
.icon-group {
    margin-top: 8px;
    display: flex;
    gap: 8px;
    /* Khoảng cách giữa các icon */
}

.icon-1,
.icon-2 {
    font-size: 18px;
    /* Kích thước vừa phải cho mobile */
    filter: drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.1));
}

/* Hiệu ứng badge offline */
ion-badge[color="warning"] {
    --color: #000;
    font-weight: bold;
    letter-spacing: 0.3px;
}

/* Làm cho các hàng có sự cố (Problem) trông khác biệt */
.custom-item-false {
    --background: #fff5f5;
    /* Nền hơi đỏ nhạt nếu có sự cố */
}

div[slot="fixed"] {
    border-bottom: 0.5px solid #e0e0e0;
    /* Hoặc shadow nhẹ */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
</style>