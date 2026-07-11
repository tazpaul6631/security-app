<template>
  <ion-page class="area-index-page">
    <header class="route-header">
      <button type="button" class="route-back-btn" :aria-label="$t('routes.go-home')" @click="router.replace('/home')">
        <i class="pi pi-arrow-left route-back-icon" aria-hidden="true" />
        <span class="route-title">{{ $t('page.areas.index') }}</span>
      </button>
    </header>

    <ion-content class="area-content">
      <div class="area-bg" aria-hidden="true">
        <span class="area-blob area-blob-green" />
        <span class="area-blob area-blob-purple" />
      </div>

      <div slot="fixed" style="width: 100%; background: var(--ion-background-color, #fff); z-index: 10;">
        <ion-segment :value="activeSegment" mode="md">
          <ion-segment-button v-for="([parent, children, id]) in datalistNav" :key="parent" :value="parent"
            @click="openSelect(parent, children, id)">
            <ion-label>{{ parent }} ▾</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>

      <ion-modal :is-open="isModalOpen" @didDismiss="isModalOpen = false" class="fixed-bottom-modal">
        <ion-header>
          <ion-toolbar class="none-padding">
            <ion-title>{{ $t('areas.index.selected') }} {{ activeSegment }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="isModalOpen = false">{{ $t('areas.index.cancel') }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
          <ion-toolbar v-if="isCurrentUserAdmin">
            <ion-item lines="none" class="filter-dropdown-item">
              <ion-icon :icon="funnelOutline" slot="start" size="small" color="medium"></ion-icon>
              <ion-select v-model="filterStatus" @ionChange="handleFilterChange" interface="popover" mode="ios"
                aria-label="Filter" class="full-width-select">
                <ion-select-option v-for="opt in filterRoleOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </ion-select-option>
              </ion-select>
            </ion-item>
          </ion-toolbar>
          <ion-progress-bar v-show="isLoading" type="indeterminate" color="primary"></ion-progress-bar>
        </ion-header>

        <ion-content class="ion-padding">
          <template v-if="modalDisplayedItems.length > 0">
            <ion-list lines="full">
              <ion-item v-for="(item, index) in modalDisplayedItems" :key="item.psId || item.routeId || index"
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
                            {{ $t('areas.index.await-sync') }}
                          </ion-badge>
                        </div>

                        <div style="margin-top: 5px;">
                          <ion-icon class="icon-1" :icon="idCardOutline"
                            :color="item.pointProblem ? 'danger' : 'success'">
                          </ion-icon>
                          <ion-icon class="icon-2"
                            :icon="item.timeFastProblem || item.timeSlowProblem ? rocketOutline : timeOutline"
                            :color="item.timeFastProblem || item.timeSlowProblem ? 'danger' : 'success'">
                          </ion-icon>
                          <ion-icon class="icon-2" :icon="walkOutline"
                            :color="item.shiftProblem ? 'danger' : 'success'">
                          </ion-icon>
                        </div>
                      </ion-label>
                    </ion-col>

                    <ion-col size="6" class="ion-text-end">
                      <div class="note-container">
                        <ion-label class="labelItem" color="medium">{{ item.reportName
                        }}</ion-label>
                        <ion-badge :color="item.realityPoint >= item.planPoint ? 'success' : 'medium'"
                          style="margin-top: 4px; color: white;">
                          {{ item.realityPoint || 0 }}/{{ item.planPoint || 0 }} {{
                            $t('areas.index.points') }}
                        </ion-badge>

                        <p v-if="item.realityHours || item.realityMinutes" class="timer-total">
                          <ion-icon :icon="timeOutline" style="font-size: 10px;"></ion-icon>
                          {{ item.realityHours ? `${item.realityHours}h` : '' }}
                          {{ item.realityMinutes ? `${item.realityMinutes}m` : '' }}
                          {{ item.realitySeconds ? `${item.realitySeconds}s` : '' }}
                        </p>
                      </div>
                    </ion-col>
                  </ion-row>
                  <ion-row>
                    <ion-col size="6" class="pad-0">
                      <ion-label class="labelItem" color="secondary">{{
                        item.shiftStart?.replace('T', ' ').slice(0, 16) }}</ion-label>
                    </ion-col>
                    <ion-col size="6" class="ion-text-end pad-0">
                      <ion-label class="labelItem" color="secondary">{{
                        item.shiftEnd?.replace('T', ' ').slice(0, 16) }}</ion-label>
                    </ion-col>
                  </ion-row>
                </ion-grid>
              </ion-item>
            </ion-list>
            <ion-infinite-scroll @ionInfinite="loadMoreModalData($event)" :disabled="isModalInfiniteDisabled">
              <ion-infinite-scroll-content :loading-text="$t('areas.index.load-more')"
                loading-spinner="bubbles"></ion-infinite-scroll-content>
            </ion-infinite-scroll>
          </template>
          <div v-else-if="!isLoading" class="ion-padding ion-text-center">
            <ion-icon :icon="calendarOutline" style="font-size: 64px; color: #ccc;"></ion-icon>
            <p>{{ $t('areas.index.emty-data') }}</p>
          </div>
        </ion-content>
      </ion-modal>

      <div class="area-body">
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
          <p>{{ $t('areas.index.emty-data') }}: <strong style="color: red;">
              {{ $t('areas.index.please-route') }}
            </strong></p>
          <ion-button fill="outline" @click="router.replace('/home')" class="ion-margin-top">
            {{ $t('areas.index.go-home') }}
          </ion-button>
        </div>

        <ion-list v-else>
          <ion-item v-for="item in displayedItems" :key="item.prId" :button="true"
            @click="handleSelectedRow(Number(item.prId), $event)"
            :class="item.prHasProblem || item.shiftProblem || item.timeProblem ? 'custom-item-false' : 'custom-item-true'">
            <ion-grid>
              <ion-row class="ion-align-items-center">
                <ion-col>
                  <ion-label>
                    <strong>{{ item.cpName }}</strong>
                    <div style="margin-top: 5px;">
                      <ion-icon :icon="newspaperOutline" :color="item.prHasProblem ? 'danger' : 'success'"></ion-icon>
                      <ion-icon class="icon-2" :icon="timeOutline"
                        :color="item.shiftProblem || item.timeProblem ? 'danger' : 'success'">
                      </ion-icon>
                    </div>
                    <ion-text color="warning" v-if="item.isOfflineMock" style="font-size: 0.8em; display: block;">
                      <ion-text color="danger">* </ion-text> {{ $t('areas.index.await-sync') }}...
                    </ion-text>
                  </ion-label>
                </ion-col>
                <ion-col size="auto" class="ion-text-end">
                  <ion-label class="labelItem">{{ item.reportName }}</ion-label>
                  <ion-note class="labelItem">{{ item.reportAt?.replace('T', ' ').slice(0, 16)
                  }}</ion-note>
                </ion-col>
              </ion-row>
            </ion-grid>
          </ion-item>
        </ion-list>

        <ion-infinite-scroll ref="infiniteScrollRef" @ionInfinite="loadMoreData($event)" :disabled="isInfiniteDisabled">
          <ion-infinite-scroll-content :loading-text="$t('areas.index.load-more')"
            loading-spinner="bubbles"></ion-infinite-scroll-content>
        </ion-infinite-scroll>
      </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import PointReport from '@/api/PointReport';
import router from '@/router';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonTitle, IonLabel,
  IonSegment, IonSegmentButton, IonContent, IonIcon, IonGrid, IonRow, IonCol,
  IonText, IonNote, IonItem, IonList,
  onIonViewWillEnter, IonProgressBar, IonSkeletonText, IonInfiniteScroll,
  IonInfiniteScrollContent, IonButton, IonModal, IonBadge, IonSelect, IonSelectOption,
  useBackButton
} from '@ionic/vue';
import { calendarOutline, footstepsOutline, newspaperOutline, timeOutline, funnelOutline, rocketOutline, walkOutline, idCardOutline } from "ionicons/icons";
import { computed, ref, watch } from 'vue';
import { useStore } from 'vuex';
import presentAlert from '@/mixins/presentAlert';
import AreaBU from '@/api/AreaBU';
import Role from '@/api/Role';
import { useI18n } from 'vue-i18n';
import { useAppLoading } from '@/composables/useAppLoading';

const store = useStore();
const { show: showLoading, hide: hideLoading } = useAppLoading();

// --- STATE QUẢN LÝ UI VÀ PHÂN TRANG ---
const isReturningFromDetail = ref(false);
const activeSegment = ref<string>('');
const selectedItem = ref<any>(null);
const isModalOpen = ref(false);
const isLoading = ref(false);
const { t } = useI18n();

const displayedItems = ref<any[]>([]);
const currentPage = ref(1);
const isInfiniteDisabled = ref(false);
const itemsPerPage = 15;

const areasCache = ref<any[]>([]);
const listRoles = ref<any[]>([]);
const filterStatus = ref<string | number>('all');
const currentActiveAreaId = ref<number | null>(null);

const currentOptions = ref<any[]>([]);
const modalDisplayedItems = ref<any[]>([]);
const modalCurrentPage = ref(1);
const isModalInfiniteDisabled = ref(false);
const modalItemsPerPage = 5;
///////////////////////////////////////////////////

// --- COMPUTED: THÔNG TIN USER GOM CHUNG ---
const userInfo = computed(() => store.state.dataUser?.data || store.state.dataUser || {});
const isCurrentUserAdmin = computed(() => userInfo.value.userRoleIsAdmin === true);
const currentUserId = computed(() => userInfo.value.userId);
const isOnline = computed(() => store.state.isOnline);
////////////////////////////////////////////////////

// --- COMPUTED: DỮ LIỆU ---
const datalistNav = computed(() => {
  const rawData = areasCache.value.length > 0 ? areasCache.value : store.state.dataAreaBU;
  const areas = normalizeAreasList(rawData);
  const result: [string, any[], number][] = [];

  for (const item of areas) {
    if (isCurrentUserAdmin.value || item.areaId === userInfo.value.userAreaId) {
      result.push([item.areaCode, item.patrolShifts || [], item.areaId]);
    }
  }
  return result;
});

const dataPR = computed(() => {
  if (!selectedItem.value) return { details: [] };

  const dataStore = store.state.dataListCP;
  const listDetails = Array.isArray(dataStore) && dataStore.length > 0
    ? (dataStore[0]?.data || dataStore)
    : (dataStore?.data || []);

  const safeList = Array.isArray(listDetails) ? listDetails : [];

  return {
    details: safeList.map((item: any) => ({
      prId: item.prId,
      cpName: item.cpName || item.cpCode,
      createdName: item.createdName,
      createdAt: item.createdAt || '',
      prHasProblem: item.prHasProblem,
      isOfflineMock: item.isOfflineMock || false,
      reportName: item.reportName,
      reportAt: item.reportAt,
      timeProblem: item.timeProblem,
      shiftProblem: item.shiftProblem
    }))
  };
});
////////////////////////////////////////////////////////////

// --- WATCHERS ---
watch(() => dataPR.value.details, (newVal) => {
  if (currentPage.value === 1) {
    displayedItems.value = newVal.slice(0, itemsPerPage);
  } else {
    const currentCount = displayedItems.value.length;
    displayedItems.value = newVal.slice(0, Math.max(currentCount, itemsPerPage));
  }
  isInfiniteDisabled.value = displayedItems.value.length >= newVal.length;
}, { deep: true, immediate: true });

watch(() => currentOptions.value, (newVal) => {
  modalCurrentPage.value = 1;
  modalDisplayedItems.value = newVal.slice(0, modalItemsPerPage);
  isModalInfiniteDisabled.value = modalDisplayedItems.value.length >= newVal.length;
}, { deep: true, immediate: true });
//////////////////////////////////////////////

// --- METHODS TẢI DỮ LIỆU ---
const normalizeAreasList = (raw: any): any[] => {
  if (!raw) return [];
  const data = Array.isArray(raw) ? raw : (raw?.data || []);
  return Array.isArray(data) ? data : [];
};

const canUseAreasCacheForShifts = (): boolean =>
  isCurrentUserAdmin.value && filterStatus.value === 'all';

const getShiftsFromCache = (areaId: number): any[] | undefined => {
  if (!canUseAreasCacheForShifts() || areasCache.value.length === 0) return undefined;
  const found = areasCache.value.find((item: any) => Number(item.areaId) === Number(areaId));
  return found ? (found.patrolShifts || []) : [];
};

const loadAreasCache = async () => {
  if (isOnline.value) {
    try {
      const payload = isCurrentUserAdmin.value ? {} : { areaId: userInfo.value.userAreaId };
      const response = await AreaBU.postAreaBU(payload);
      if (response?.data) {
        areasCache.value = normalizeAreasList(response.data);
      }
    } catch (error) {
      console.error('Lỗi loadAreasCache:', error);
    }
  } else {
    areasCache.value = normalizeAreasList(store.state.dataAreaBU);
  }
};

const fetchRoles = async () => {
  try {
    const res = await Role.postBaseRole();
    if (res?.data) {
      listRoles.value = Array.isArray(res.data) ? res.data : (res.data.data || []);
    }
  } catch (error) {
    console.error("Lỗi fetchRoles:", error);
  }
};

const fetchAreasData = async (areaId: number) => {
  isLoading.value = true;
  currentActiveAreaId.value = areaId;

  try {
    const cachedShifts = getShiftsFromCache(areaId);
    if (cachedShifts !== undefined && isOnline.value) {
      currentOptions.value = cachedShifts;
      return;
    }

    if (isOnline.value) {
      const payload: any = { areaId };

      if (isCurrentUserAdmin.value && filterStatus.value !== 'all' && filterStatus.value !== 'admin') {
        payload.roleId = Number(filterStatus.value);
      } else if (!isCurrentUserAdmin.value) {
        payload.reportBy = currentUserId.value;
        payload.userId = currentUserId.value;
      }

      const response = await AreaBU.postAreaBU(payload);
      const fetchedAreas = normalizeAreasList(response?.data);
      const foundArea = fetchedAreas.find((item: any) => Number(item.areaId) === Number(areaId));

      currentOptions.value = foundArea ? (foundArea.patrolShifts || []) : [];

    } else {
      // Xử lý Offline (Lấy từ Vuex)
      const areas = normalizeAreasList(store.state.dataAreaBU);
      const foundArea = areas.find((item: any) => Number(item.areaId) === Number(areaId));
      let shifts = foundArea ? (foundArea.patrolShifts || []) : [];

      // Khi offline, nếu là user thường thì lọc ca của chính mình
      if (!isCurrentUserAdmin.value) {
        shifts = shifts.filter((s: any) => String(s.reportBy) === String(currentUserId.value));
      }
      currentOptions.value = shifts;
    }
  } catch (error) {
    console.error("Lỗi fetchAreasData:", error);
    currentOptions.value = [];
  } finally {
    isLoading.value = false;
  }
};
////////////////////////////////////////////

// --- METHODS FILTER LABEL ---
const labelName = ref([
  { id: 3, label: 'areas.index.expat' },
  { id: 4, label: 'areas.index.security' }
])

const getLabelData = (roleId: number): string => {
  const item = labelName.value.find(r => r.id === roleId);
  return item ? item.label : '';
};

const filterRoleOptions = computed(() => {
  const normalRoles = listRoles.value.filter(r => r.roleIsAdmin === false);
  return [
    { value: 'all', label: t('areas.index.all') },
    ...normalRoles.map(r => ({ value: r.roleId, label: t(getLabelData(r.roleId)) }))
  ];
});
//////////////////////////////////////

// --- METHODS TƯƠNG TÁC GIAO DIỆN ---
const initDefaultTab = async () => {
  if (datalistNav.value.length > 0) {
    filterStatus.value = 'all';
    const firstTab = datalistNav.value[0];
    activeSegment.value = firstTab[0];
    const firstAreaId = firstTab[2];
    isModalOpen.value = true;
    await fetchAreasData(firstAreaId);
  }
};

onIonViewWillEnter(async () => {
  if (isCurrentUserAdmin.value) {
    await fetchRoles();
  }
  await loadAreasCache();

  if (isReturningFromDetail.value) {
    isReturningFromDetail.value = false;
  } else {
    selectedItem.value = null;
    activeSegment.value = '';
    currentActiveAreaId.value = null;
    displayedItems.value = [];

    await initDefaultTab();
  }
});

const openSelect = async (parent: string, _children: any[], id: number) => {
  filterStatus.value = 'all';
  activeSegment.value = parent;
  isModalOpen.value = true;
  displayedItems.value = [];
  currentOptions.value = [];
  await fetchAreasData(id);
};

const handleFilterChange = async () => {
  if (isModalOpen.value && currentActiveAreaId.value !== null) {
    modalDisplayedItems.value = [];
    await fetchAreasData(currentActiveAreaId.value);
  }
};

const handleModalSelection = async (item: any) => {
  isModalOpen.value = false;
  currentPage.value = 1;

  setTimeout(async () => {
    isLoading.value = true;
    selectedItem.value = [item.routeName, item.routeId];

    try {
      let finalReports = [];
      if (isOnline.value) {
        try {
          const responseBU = await PointReport.postBasePointReportView(item.psId);
          finalReports = Array.isArray(responseBU?.data) ? responseBU.data : (responseBU?.data?.data || []);
        } catch (e) {
          console.warn("API lỗi, chuyển sang Offline data.");
        }
      }

      // if (finalReports.length === 0) {
      //     const baseReports = Array.isArray(store.state.dataBasePointReportView)
      //         ? store.state.dataBasePointReportView : (store.state.dataBasePointReportView?.data || []);
      //     const recentReports = Array.isArray(store.state.dataCheckpointsId)
      //         ? store.state.dataCheckpointsId : (store.state.dataCheckpointsId?.data || []);

      //     const combined = [...recentReports, ...baseReports];

      //     finalReports = combined.filter((rep: any) => {
      //         const isRightShift = Number(rep.psId) === Number(item.psId);
      //         const isRightUser = isCurrentUserAdmin.value || Number(rep.reportBy) === currentUserId.value || Number(rep.userId) === currentUserId.value;
      //         return isRightShift && isRightUser;
      //     });

      //     // Lọc trùng cpId
      //     const uniqueMap = new Map();
      //     finalReports.forEach(r => {
      //         if (uniqueMap.has(r.cpId) && !r.isOfflineMock) return;
      //         uniqueMap.set(r.cpId, r);
      //     });
      //     finalReports = Array.from(uniqueMap.values());
      // }

      finalReports.sort((a: any, b: any) => new Date(b.reportAt).getTime() - new Date(a.reportAt).getTime());
      store.commit('SET_DATACP', [{ data: finalReports }]);
    } catch (error) {
      console.error("Lỗi handleModalSelection:", error);
    } finally {
      isLoading.value = false;
    }
  }, 300);
};

const handleSelectedRow = async (prId: number, event?: any) => {
  showLoading(t('areas.index.message.1'));

  try {
    let detailData = null;

    // 1. CHỈ GỌI TRỰC TIẾP API LẤY CHI TIẾT
    if (isOnline.value) {
      const res = await PointReport.getPointReportId(prId);
      if (res?.data) {
        detailData = res.data;
      }
    } else {
      // Nếu rớt mạng lúc đang bấm vào xem chi tiết
      throw new Error("Không có kết nối mạng");
    }

    if (!detailData?.data) throw new Error("No data");

    isReturningFromDetail.value = true;

    // 2. Lưu vào Store và chuyển trang
    store.commit('SET_CURRENT_CHECKPOINT', detailData);
    router.push({ path: `/checkpoint/detail/${prId}` });

  } catch (error: any) {
    console.error(error);
    const msg = error.message === t('areas.index.message.2')
      ? t('areas.index.message.3')
      : t('areas.index.message.4');
    presentAlert.presentAlert(t('areas.index.message.5'), '', msg);
  } finally {
    hideLoading();
  }
};
///////////////////////////////////////////////////

// --- METHODS INFINITE SCROLL ---
const loadMoreData = (event: any) => {
  setTimeout(() => {
    const nextStart = currentPage.value * itemsPerPage;
    const nextBatch = dataPR.value.details.slice(nextStart, nextStart + itemsPerPage);
    if (nextBatch.length > 0) {
      displayedItems.value.push(...nextBatch);
      currentPage.value++;
    }
    event.target.complete();
    isInfiniteDisabled.value = displayedItems.value.length >= dataPR.value.details.length;
  }, 500);
};

const loadMoreModalData = (event: any) => {
  setTimeout(() => {
    const nextStart = modalCurrentPage.value * modalItemsPerPage;
    const nextBatch = currentOptions.value.slice(nextStart, nextStart + modalItemsPerPage);
    if (nextBatch.length > 0) {
      modalDisplayedItems.value.push(...nextBatch);
      modalCurrentPage.value++;
    }
    event.target.complete();
    isModalInfiniteDisabled.value = modalDisplayedItems.value.length >= currentOptions.value.length;
  }, 500);
};
///////////////////////////////////////////////

useBackButton(10, () => {
  router.replace('/home');
});
</script>

<style scoped>
.area-index-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.route-header {
  min-height: 48px;
  padding: 4px 8px 4px 4px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.route-back-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 8px;
  min-height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 10px;
  text-align: left;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
  font: inherit;
}

.route-back-btn:hover,
.route-back-btn:focus,
.route-back-btn:focus-visible,
.route-back-btn:active {
  background: transparent;
  outline: none;
  box-shadow: none;
}

.route-back-icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: #334155;
}

.route-title {
  flex: 1;
  min-width: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.area-content {
  flex: 1;
  min-height: 0;
  --background: #d1e5e6;
}

.area-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.area-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(72px);
  -webkit-filter: blur(72px);
  opacity: 0.9;
}

.area-blob-green {
  width: 250px;
  height: 250px;
  background: #e3f7ac;
  top: 20%;
  right: -50px;
}

.area-blob-purple {
  width: 250px;
  height: 250px;
  background: #cac2e9;
  bottom: 10%;
  left: -80px;
}

.area-body {
  position: relative;
  z-index: 1;
}

.pointProblem-danger,
.timeProblem-danger {
  color: #eb445a;
}

.pointProblem-success,
.timeProblem-success {
  color: #2dd36f;
}

.pad-0 {
  padding: 0;
}

.timer-total {
  font-size: 0.75em;
  margin: 4px 0 0 0;
  display: flex;
  align-items: center;
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

.icon-group {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.icon-1,
.icon-2 {
  font-size: 18px;
  filter: drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.1));
}

ion-badge[color="warning"] {
  --color: #000;
  font-weight: bold;
  letter-spacing: 0.3px;
}

.custom-item-false {
  --background: #fff5f5;
}

div[slot="fixed"] {
  border-bottom: 0.5px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Custom CSS để ép Modal nằm sát đáy và cố định chiều cao */
ion-modal.fixed-bottom-modal {
  --height: 75vh;
  /* Set cứng chiều cao (ví dụ 50% chiều cao màn hình) */
  --border-radius: 16px 16px 0 0;
  /* Bo tròn 2 góc trên cho đẹp */
  align-items: flex-end;
  /* Căn chỉnh Modal nằm sát dưới đáy */
}

ion-modal.fixed-bottom-modal::part(backdrop) {
  opacity: 0.3;
  /* Độ mờ tùy chỉnh */
}

.filter-dropdown-item {
  --min-height: 38px;
  --background: var(--ion-color-light);
  margin: 0 10px 8px 10px;
  border-radius: 8px;
  font-size: 14px;
  width: fit-content;
}

.full-width-select {
  width: 100%;
  --placeholder-color: var(--ion-color-medium);
  --placeholder-opacity: 1;
}

ion-icon[slot="start"] {
  margin-inline-end: 8px;
}
</style>