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
            <ion-segment :scrollable="true" :value="activeSegment">
                <ion-segment-button v-for="([parent, children, id]) in datalistNav" :key="parent" :value="parent"
                    @click="openSelect(parent, children, id)">
                    <ion-label>{{ parent }} ▾</ion-label>
                </ion-segment-button>
            </ion-segment>

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
                    <ion-list v-if="currentOptions.length > 0">
                        <ion-item v-for="(item, index) in currentOptions" :key="item.psId || item.routeId || index"
                            :button="true" @click="handleModalSelection(item)">
                            <ion-grid>
                                <ion-row class="ion-align-items-center">
                                    <ion-col>
                                        <ion-label>
                                            <strong
                                                :style="item.isOfflineDone ? 'color: var(--ion-color-primary)' : ''">
                                                {{ item.routeCode }}
                                            </strong> - {{ item.routeName }}

                                            <div v-if="item.isOfflineDone">
                                                <ion-badge color="warning" mode="ios" style="font-size: 0.7em;">
                                                    Chờ đồng bộ server
                                                </ion-badge>
                                            </div>

                                            <div>
                                                <ion-icon class="icon-1"
                                                    :icon="item.isOfflineDone ? newspaperOutline : (item.pointProblem || item.timeProblem ? warningOutline : newspaperOutline)"
                                                    :color="item.isOfflineDone ? 'primary' : (item.pointProblem || item.timeProblem ? 'danger' : 'success')">
                                                </ion-icon>

                                                <ion-icon class="icon-2" :icon="timeOutline"
                                                    :color="item.isOfflineDone ? 'primary' : (item.timeProblem ? 'danger' : 'success')">
                                                </ion-icon>
                                            </div>
                                        </ion-label>
                                    </ion-col>
                                    <ion-col class="ion-text-end">
                                        <ion-note class="labelItem">
                                            <ion-label class="labelItem">{{ item.reportName }}</ion-label>
                                            <div>
                                                {{ item.realityPoint }}/{{ item.planPoint }} điểm
                                            </div>
                                            <div>
                                                {{ item.realityHours ? `${item.realityHours} giờ` : '' }}
                                                {{ item.realityMinutes ? `${item.realityMinutes} phút` : '' }}
                                                {{ item.realitySeconds ? `${item.realitySeconds} giây` : '' }}
                                            </div>
                                        </ion-note>
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

            <div class="list-container" style="margin-top: 10px;">
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
                            {{ selectedItem ? selectedItem[0] : 'Vui lòng chọn lộ trình' }}
                        </strong></p>
                    <ion-button fill="clear" @click="router.replace('/home')">Về trang chủ</ion-button>
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
import { calendarOutline, newspaperOutline, timeOutline, warningOutline } from "ionicons/icons";
import { computed, ref, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import presentAlert from '@/mixins/presentAlert';
import AreaBU from '@/api/AreaBU';

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
        const isAuthorizedArea = isAdmin || (item.areaId === userAreaId);
        if (isAuthorizedArea) {
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

    try {
        const userInfo = store.state.dataUser?.data || store.state.dataUser || {};
        const isAdmin = userInfo.userRoleIsAdmin === true;
        const currentUserId = userInfo.userId;

        if (isOnline.value) {
            // ONLINE 
            const payload: any = { areaId: areaId };
            if (!isAdmin) {
                payload.userId = currentUserId;
            }

            console.log('online');

            const response = await AreaBU.postAreaBU(payload);
            const fetchedAreas = Array.isArray(response?.data) ? response.data : (response?.data?.data || []);
            const foundArea = fetchedAreas.find((item: any) => item.areaId === areaId) || fetchedAreas[0];

            let onlineShifts = foundArea ? (foundArea.patrolShifts || []) : [];
            currentOptions.value = onlineShifts;
        } else {
            // OFFLINE 
            const rawData = store.state.dataAreaBU;
            let areas = [];

            // 1. Xử lý cẩn thận cấu trúc data lấy từ store (Cover mọi trường hợp lồng data)
            if (Array.isArray(rawData) && rawData.length > 0 && rawData[0].data) {
                areas = rawData[0].data; // Dạng [{ data: [...] }]
            } else if (Array.isArray(rawData)) {
                areas = rawData; // Dạng [...]
            } else {
                areas = rawData?.data || []; // Dạng { data: [...] }
            }

            // 2. Tìm Area: Ép kiểu Number để chắc chắn không bị lỗi '1' !== 1
            const foundArea = areas.find((item: any) => Number(item.areaId) === Number(areaId));
            let offlineShifts = foundArea ? (foundArea.patrolShifts || []) : [];

            console.log('offline - Shifts gốc tìm được:', offlineShifts);

            // 3. Xử lý phân quyền User
            if (!isAdmin) {
                // Chỉ filter NẾU data shift thực sự có chứa trường `userId`
                // Nếu không có, mặc định lấy toàn bộ vì data store đã được API lọc từ trước lúc Online
                const hasUserIdProp = offlineShifts.length > 0 && offlineShifts[0].hasOwnProperty('userId');

                if (hasUserIdProp) {
                    offlineShifts = offlineShifts.filter((shift: any) => shift.userId === currentUserId);
                }
            }

            currentOptions.value = offlineShifts;
        }
    } catch (error) {
        console.error("Lỗi khi tải danh sách:", error);
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
    currentOptions.value = []; // Tạm làm rỗng để hiển thị loading skeleton
    await fetchAreasData(id);
};

// --- CÁC METHODS XỬ LÝ CHỌN LỘ TRÌNH ---
const handleModalSelection = async (item: any) => {
    isModalOpen.value = false;
    currentPage.value = 1;

    setTimeout(async () => {
        isLoading.value = true;
        selectedItem.value = [item.routeName, item.routeId];

        try {
            let reportData = null;
            if (isOnline.value) {
                const responseBU = await PointReport.postBasePointReportView(item.psId);
                const actualArray = Array.isArray(responseBU?.data) ? responseBU.data : (responseBU?.data?.data || []);
                reportData = { data: actualArray };
            }

            if (!reportData) {
                const rawCheckpointsId = store.state.dataBasePointReportView;
                const allReports = Array.isArray(rawCheckpointsId) ? rawCheckpointsId : (rawCheckpointsId?.data || []);

                const filteredReports = allReports.filter((rep: any) =>
                    rep.psId === item.psId || rep.psId === Number(item.psId)
                );

                reportData = { data: filteredReports };
            }

            store.commit('SET_DATACP', [reportData]);
            await nextTick();

        } finally {
            isLoading.value = false;
        }
    }, 300);
};

const handleSelectedRow = async (prId: number) => {
    const loading = await loadingController.create({ message: 'Đang tải chi tiết...', spinner: 'crescent' });
    try {
        await loading.present();
        let detailData = null;

        const storeData = Array.isArray(store.state.dataCheckpointsId) ? store.state.dataCheckpointsId : (store.state.dataCheckpointsId?.data || []);
        const found = storeData.find((rep: any) => String(rep.prId) === String(prId));

        if (found) {
            detailData = { data: found };
        } else if (isOnline.value) {
            const res = await PointReport.getPointReportId(prId);
            if (res?.data) detailData = res.data;
        }

        if (!detailData?.data) throw new Error("No data");

        store.commit('SET_CURRENT_CHECKPOINT', detailData);
        router.push({ path: `/checkpoint/detail/${prId}` });
    } catch (error) {
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

.labelItem {
    font-size: 0.9em;
    display: block;
}

ion-segment {
    margin-bottom: 5px;
}

.icon-1 {
    padding: 5px 2px 0 0;
}

.icon-2 {
    padding: 5px 2px 0 2px;
}
</style>