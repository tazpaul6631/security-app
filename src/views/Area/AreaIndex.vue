<template>
  <div class="area-index-page">
    <header class="route-header">
      <button type="button" class="route-back-btn" :aria-label="$t('routes.go-home')" @click="router.replace('/home')">
        <i class="pi pi-arrow-left route-back-icon" aria-hidden="true" />
        <span class="route-title">{{ $t('page.areas.index') }}</span>
      </button>
    </header>

    <AppPageContent class="area-content">
      <div class="area-bg" aria-hidden="true">
        <span class="area-blob area-blob-green" />
        <span class="area-blob area-blob-purple" />
      </div>

      <div class="area-tabs">
        <button v-for="([parent, children, id]) in datalistNav" :key="parent" type="button" class="area-tab"
          :class="{ active: activeSegment === parent }" @click="openSelect(parent, children, id)">
          {{ parent }} ▾
        </button>
      </div>

      <Dialog v-model:visible="isModalOpen" modal position="center" class="area-shift-dialog"
        :style="{ width: 'min(98vw, 100dvw)', height: '80%' }" :draggable="false" :dismissable-mask="false"
        :close-on-escape="!isFilterPickerOpen" :closable="false" :pt="{
          mask: {
            class: 'area-shift-dialog-mask',
            onMousedown: onShiftDialogMaskMouseDown,
            onMouseup: onShiftDialogMaskMouseUp,
          },
          root: { class: 'area-shift-dialog-root' },
          content: { class: 'area-shift-dialog-content' },
        }">
        <template #header>
          <div class="filter-row">
            <span class="filter-title">{{ $t('areas.index.selected') }} {{ activeSegment }}</span>
            <DatePicker ref="filterPickerRef" v-model="filterDateTime" dateFormat="dd/mm/yy" showTime hourFormat="24"
              hideOnDateTimeSelect fluid showIcon iconDisplay="input" showClear class="filter-select"
              panelClass="area-filter-datepicker-panel" :placeholder="$t('areas.index.filter-datetime')"
              @show="isFilterPickerOpen = true" @hide="isFilterPickerOpen = false" />
          </div>
        </template>
        <div v-if="isFilterPickerOpen" class="filter-picker-catcher" @pointerdown.prevent.stop="closeFilterPicker" />
        <ProgressBar v-show="isLoading" mode="indeterminate" class="shift-progress" />

        <div ref="shiftModalBodyRef" class="shift-modal-body">
          <template v-if="modalDisplayedItems.length > 0">
            <button v-for="(item, index) in modalDisplayedItems" :key="item.psId || item.routeId || index" type="button"
              class="shift-row" @click="handleModalSelection(item)"
              :class="{ 'shift-row-completed': item.isCompleted }">
              <div class="shift-row-top">
                <div class="shift-row-main">
                  <strong :class="{ 'shift-done': item.isOfflineDone || item.realityPoint > 0 }"
                    :style="{ color: item.isComplete ? '' : '#FF0000' }">
                    {{ item.routeCode }}
                  </strong>
                  <p class="shift-route-name" :style="{ color: item.isComplete ? '' : '#FF0000' }">{{ item.routeName }}
                  </p>
                  <Tag v-if="item.isOfflineDone" :value="$t('areas.index.await-sync')" severity="warn"
                    class="offline-tag" />
                  <div class="shift-icons">
                    <i class="pi pi-share-alt icon-1" :class="item.pointProblem ? 'icon-danger' : 'icon-success'" />
                    <i class="pi icon-2"
                      :class="item.timeFastProblem || item.timeSlowProblem ? 'pi-bolt icon-danger' : 'pi-clock icon-success'" />
                    <i class="pi pi-map icon-2" :class="item.shiftProblem ? 'icon-danger' : 'icon-success'" />
                  </div>
                </div>
                <div class="note-container">
                  <span class="labelItem" :style="{ color: item.isComplete ? '' : '#FF0000' }">
                    {{ item.reportName }}
                  </span>
                  <Tag :value="`${item.realityPoint || 0}/${item.planPoint || 0} ${$t('areas.index.points')}`"
                    :severity="item.realityPoint >= item.planPoint ? 'success' : 'danger'" />
                  <p v-if="item.realityHours || item.realityMinutes" class="timer-total">
                    <i class="pi pi-clock" />
                    {{ item.realityHours ? `${item.realityHours}h` : '' }}
                    {{ item.realityMinutes ? `${item.realityMinutes}m` : '' }}
                    {{ item.realitySeconds ? `${item.realitySeconds}s` : '' }}
                  </p>
                </div>
              </div>
              <div class="shift-row-times">
                <span>
                  {{ item.shiftStart?.replace('T', ' ').slice(0, 16) }}
                </span>
                <span>
                  {{ item.shiftEnd?.replace('T', ' ').slice(0, 16) }}
                </span>
              </div>
            </button>
            <div v-if="!isModalInfiniteDisabled" ref="sentinelRef" class="infinite-sentinel">
              <template v-if="isLoadingMore">
                <ProgressSpinner stroke-width="4" style="width: 28px; height: 28px" />
                <span>{{ $t('areas.index.load-more') }}</span>
              </template>
            </div>
          </template>
          <div v-else-if="!isLoading" class="empty-state">
            <i class="pi pi-calendar empty-icon" />
            <p>{{ $t('areas.index.emty-data') }}</p>
          </div>
        </div>
      </Dialog>

      <div class="area-body">
        <div class="list-container report-list-scroll">
          <div v-if="isLoading" class="skeleton-list">
            <div v-for="i in 5" :key="i" class="skeleton-row">
              <Skeleton shape="circle" size="24px" />
              <Skeleton width="70%" height="16px" />
            </div>
          </div>

          <div v-else-if="dataPR.details.length === 0" class="empty-state no-route-container">
            <i class="pi pi-calendar empty-icon" />
            <p>{{ $t('areas.index.emty-data') }}: <strong class="empty-hint">
                {{ $t('areas.index.please-route') }}
              </strong></p>
            <Button :label="$t('areas.index.go-home')" severity="secondary" variant="outlined" class="empty-home-btn"
              size="large" @click="router.replace('/home')" />
          </div>

          <template v-else>
            <button v-for="item in dataPR.details" :key="item.prId" type="button" class="report-row"
              :class="item.prHasProblem || item.shiftProblem || item.timeProblem ? 'custom-item-false' : 'custom-item-true'"
              @click="handleSelectedRow(Number(item.prId), $event)">
              <div class="report-row-main">
                <strong class="shift-done">{{ item.cpName }}</strong>
                <div class="shift-icons">
                  <i class="pi pi-file" :class="item.prHasProblem ? 'icon-danger' : 'icon-success'" />
                  <i class="pi pi-clock icon-2"
                    :class="item.shiftProblem || item.timeProblem ? 'icon-danger' : 'icon-success'" />
                </div>
                <span v-if="item.isOfflineMock" class="offline-hint">
                  <span class="note-star">*</span> {{ $t('areas.index.await-sync') }}...
                </span>
              </div>
              <div class="note-container">
                <span class="labelItem">{{ item.reportName }}</span>
                <span class="shift-row-times">{{ item.reportAt?.replace('T', ' ').slice(0, 16) }}</span>
              </div>
            </button>
          </template>
        </div>
      </div>
    </AppPageContent>
  </div>
</template>

<script setup lang="ts">
import PointReport from '@/api/PointReport';
import router from '@/router';
import AppPageContent from '@/components/AppPageContent.vue';
import { useHardwareBackButton } from '@/composables/useHardwareBackButton';
import { useInfiniteScroll } from '@/composables/useInfiniteScroll';
import { computed, onActivated, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { presentAlertToast } from '@/services/toast.service';
import AreaBU from '@/api/AreaBU';
import { useI18n } from 'vue-i18n';
import { useAppLoading } from '@/composables/useAppLoading';
import { Button, DatePicker, Dialog, ProgressBar, ProgressSpinner, Skeleton, Tag } from '@/plugins/primevue.components';

const store = useStore();
const { show: showLoading, hide: hideLoading } = useAppLoading();

// --- STATE QUẢN LÝ UI ---
const isReturningFromDetail = ref(false);
const activeSegment = ref<string>('');
const selectedItem = ref<any>(null);
const isModalOpen = ref(false);
const shiftModalBodyRef = ref<HTMLElement | null>(null);
const isLoading = ref(false);
const { t } = useI18n();

const areasCache = ref<any[]>([]);
const filterDateTime = ref<Date | null>(null);
const filterPickerRef = ref<{ overlayVisible?: boolean } | null>(null);
const isFilterPickerOpen = ref(false);
const currentActiveAreaId = ref<number | null>(null);

const closeFilterPicker = () => {
  const picker = filterPickerRef.value;
  if (picker) picker.overlayVisible = false;
  isFilterPickerOpen.value = false;
};

let maskMouseDownOnMask = false;
let maskDownClosedPicker = false;

const isShiftDialogMask = (el: EventTarget | null) =>
  el instanceof HTMLElement && el.classList.contains('area-shift-dialog-mask');

const onShiftDialogMaskMouseDown = (event: MouseEvent) => {
  maskMouseDownOnMask = isShiftDialogMask(event.target);
  maskDownClosedPicker = isFilterPickerOpen.value;
  if (maskMouseDownOnMask && isFilterPickerOpen.value) {
    closeFilterPicker();
  }
};

const onShiftDialogMaskMouseUp = (event: MouseEvent) => {
  if (!maskMouseDownOnMask || !isShiftDialogMask(event.target)) return;
  if (maskDownClosedPicker) {
    maskDownClosedPicker = false;
    return;
  }
  isModalOpen.value = false;
};

watch(isModalOpen, (open) => {
  if (!open) closeFilterPicker();
});

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
  const areas = normalizeAreasList(areasCache.value);
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

const shiftTimeMs = (iso?: string) => {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? NaN : t;
};

const filteredShifts = computed(() => {
  const all = currentOptions.value;
  const picked = filterDateTime.value;
  if (!picked) return all;

  const hour = picked.getHours();
  const minute = picked.getMinutes();

  if (hour === 0 && minute === 0) {
    const dayStart = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    return all.filter((item) => {
      const start = shiftTimeMs(item.shiftStart);
      const end = shiftTimeMs(item.shiftEnd);
      if (Number.isNaN(start) || Number.isNaN(end)) return false;
      return start < dayEnd && end > dayStart;
    });
  }

  const t = picked.getTime();
  return all.filter((item) => {
    const start = shiftTimeMs(item.shiftStart);
    const end = shiftTimeMs(item.shiftEnd);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return t >= start && t <= end;
  });
});

// --- WATCHERS ---
watch(filteredShifts, (newVal) => {
  modalCurrentPage.value = 1;
  modalDisplayedItems.value = newVal.slice(0, modalItemsPerPage);
  isModalInfiniteDisabled.value = modalDisplayedItems.value.length >= newVal.length;
}, { immediate: true });
//////////////////////////////////////////////

// --- METHODS TẢI DỮ LIỆU ---
const normalizeAreasList = (raw: any): any[] => {
  if (!raw) return [];
  const data = Array.isArray(raw) ? raw : (raw?.data || []);
  return Array.isArray(data) ? data : [];
};

const loadAreasCache = async () => {
  if (!isOnline.value) {
    areasCache.value = [];
    return;
  }

  try {
    // Admin: {} — list tab + shifts; Non-admin: area của user
    // Tab đầu dùng luôn shifts từ response này (không gọi API lần 2)
    const payload = isCurrentUserAdmin.value
      ? {}
      : { areaId: userInfo.value.userAreaId, reportBy: currentUserId.value };
    const response = await AreaBU.postAreaBU(payload);
    if (response?.data) {
      areasCache.value = normalizeAreasList(response.data);
      store.commit('SET_DATA_AREA_BU', response.data);
    }
  } catch (error) {
    console.error('Lỗi loadAreasCache:', error);
    areasCache.value = [];
  }
};

const fetchAreasData = async (areaId: number) => {
  isLoading.value = true;
  currentActiveAreaId.value = areaId;

  try {
    if (!isOnline.value) {
      currentOptions.value = [];
      presentAlertToast(
        t('areas.index.message.5'),
        '',
        t('areas.index.message.3')
      );
      return;
    }

    const payload: any = { areaId };

    if (!isCurrentUserAdmin.value) {
      payload.reportBy = currentUserId.value;
    }

    const response = await AreaBU.postAreaBU(payload);
    const fetchedAreas = normalizeAreasList(response?.data);
    const foundArea = fetchedAreas.find((item: any) => Number(item.areaId) === Number(areaId));

    currentOptions.value = foundArea ? (foundArea.patrolShifts || []) : [];
  } catch (error) {
    console.error("Lỗi fetchAreasData:", error);
    currentOptions.value = [];
  } finally {
    isLoading.value = false;
  }
};

const applyTabFromCache = (areaId: number) => {
  currentActiveAreaId.value = areaId;
  const found = areasCache.value.find(
    (item: any) => Number(item.areaId) === Number(areaId)
  );
  currentOptions.value = found ? (found.patrolShifts || []) : [];
};

const initDefaultTab = async () => {
  if (datalistNav.value.length === 0) return;

  filterDateTime.value = null;
  const firstTab = datalistNav.value[0];
  activeSegment.value = firstTab[0];
  const firstAreaId = firstTab[2];
  isModalOpen.value = true;

  applyTabFromCache(firstAreaId);
};

onActivated(async () => {
  if (!isOnline.value) {
    areasCache.value = [];
    currentOptions.value = [];
    selectedItem.value = null;
    store.commit('SET_DATACP', []);
    presentAlertToast(
      t('areas.index.message.5'),
      '',
      t('areas.index.message.3')
    );
    return;
  }

  void (async () => {
    await loadAreasCache();

    if (isReturningFromDetail.value) {
      isReturningFromDetail.value = false;
    } else {
      selectedItem.value = null;
      activeSegment.value = '';
      currentActiveAreaId.value = null;
      await initDefaultTab();
    }
  })();
});

const openSelect = async (parent: string, _children: any[], id: number) => {
  filterDateTime.value = null;
  activeSegment.value = parent;
  isModalOpen.value = true;
  currentOptions.value = [];
  await fetchAreasData(id);
};

const handleModalSelection = async (item: any) => {
  isModalOpen.value = false;

  setTimeout(async () => {
    isLoading.value = true;
    selectedItem.value = [item.routeName, item.routeId];

    try {
      if (!isOnline.value) {
        store.commit('SET_DATACP', []);
        presentAlertToast(
          t('areas.index.message.5'),
          '',
          t('areas.index.message.3')
        );
        return;
      }

      const responseBU = await PointReport.postBasePointReportView(item.psId);
      const finalReports = Array.isArray(responseBU?.data)
        ? responseBU.data
        : (responseBU?.data?.data || []);

      finalReports.sort((a: any, b: any) => new Date(b.reportAt).getTime() - new Date(a.reportAt).getTime());
      store.commit('SET_DATACP', [{ data: finalReports }]);
    } catch (error) {
      console.error("Lỗi handleModalSelection:", error);
      store.commit('SET_DATACP', []);
      presentAlertToast(
        t('areas.index.message.5'),
        '',
        t('areas.index.message.4')
      );
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
    presentAlertToast(t('areas.index.message.5'), '', msg);
  } finally {
    hideLoading();
  }
};
///////////////////////////////////////////////////

// --- METHODS INFINITE SCROLL (modal chọn ca) ---
const loadMoreModalData = async () => {
  const list = filteredShifts.value;
  const nextStart = modalCurrentPage.value * modalItemsPerPage;
  const nextBatch = list.slice(nextStart, nextStart + modalItemsPerPage);
  if (nextBatch.length > 0) {
    modalDisplayedItems.value.push(...nextBatch);
    modalCurrentPage.value++;
    isModalInfiniteDisabled.value = modalDisplayedItems.value.length >= list.length;
  } else {
    isModalInfiniteDisabled.value = true;
  }
};

const { sentinelRef, isLoadingMore } = useInfiniteScroll(
  isModalInfiniteDisabled,
  loadMoreModalData,
  shiftModalBodyRef,
);

useHardwareBackButton(10, () => {
  if (isFilterPickerOpen.value) {
    closeFilterPicker();
    return;
  }
  if (isModalOpen.value) {
    isModalOpen.value = false;
    return;
  }
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
  display: flex;
  flex-direction: column;
}

.area-tabs {
  position: relative;
  z-index: 10;
  display: flex;
  width: 100%;
  background: #ffffff;
  border-bottom: 0.5px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.area-tab {
  flex: 1;
  min-height: 44px;
  border: none;
  background: transparent;
  font: inherit;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
}

.area-tab.active {
  color: #0ea5e9;
  box-shadow: inset 0 -2px 0 #0ea5e9;
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
  filter: blur(40px);
  -webkit-filter: blur(40px);
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
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.list-container.report-list-scroll {
  margin-top: 0;
  flex: 1;
  min-height: 0;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.empty-hint {
  color: #eb445a;
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

  .pi {
    margin-right: 4px;
  }
}

.labelItem-time {
  font-size: 10px;
  display: block;
}

.icon-1 {
  padding: 0 2px 0 0;
}

.icon-2 {
  padding: 0 2px 0 2px;
}

.labelItem {
  font-size: 0.9em;
  display: block;
  font-weight: bold;
}

.note-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
}

.icon-1,
.icon-2 {
  font-size: 18px;
  filter: drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.1));
}

.icon-danger {
  color: #eb445a;
}

.icon-success {
  color: #2dd36f;
}

.custom-item-false {
  background: #fff5f5;
}

.shift-done {
  color: #0ea5e9;
}

.shift-route-name {
  margin: 2px 0 0;
  font-size: 0.9em;
  color: #49b6e9;
  font-weight: bold;
}

.offline-tag {
  margin-top: 4px;
  font-size: 0.7em;
}

.shift-icons {
  margin-top: 5px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  width: 100%;
}

.filter-select {
  flex: 1;
  min-width: 0;
}

.filter-row :deep(.p-datepicker),
.filter-row :deep(.p-inputtext) {
  width: 100%;
}

.shift-progress {
  height: 6px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.shift-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.shift-row,
.report-row {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: none;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  font-size: 1rem;
}

.shift-row {
  padding: 12px 0;
}

.shift-row-completed {
  opacity: 0.5;
  background: #c9ee9f;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: none;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.report-row {
  padding: 12px;
}

.shift-row-top {
  width: 100%;
  display: flex;
  justify-content: space-between;
}

.shift-row-times {
  width: 100%;
  display: flex;
  justify-content: space-between;
  color: #0ea5e9;
  font-size: 1rem;
}

.report-row {
  align-items: flex-start;
}

.report-row-main {
  flex: 1;
  min-width: 0;
}

.offline-hint {
  display: block;
  margin-top: 4px;
  font-size: 0.8em;
  color: #d97706;
}

.note-star {
  color: #ef4444;
}

.empty-state {
  text-align: center;
  padding: 24px 16px;
  color: #64748b;
}

.empty-icon {
  font-size: 4rem;
  color: #ccc;
}

.empty-home-btn {
  margin-top: 12px;
}

.skeleton-list {
  padding: 8px;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}

.infinite-sentinel {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  color: #64748b;
  font-size: 0.85rem;
}

.area-shift-dialog :deep(.p-dialog),
.area-shift-dialog :deep(.area-shift-dialog-root) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-width: 100%;
  max-height: 100%;
  margin: 0;
  border-radius: 16px;
}

.area-shift-dialog :deep(.p-dialog-header) {
  flex-shrink: 0;
}

.area-shift-dialog :deep(.p-dialog-content),
.area-shift-dialog :deep(.area-shift-dialog-content) {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.filter-picker-catcher {
  position: absolute;
  inset: 0;
  z-index: 4;
  background: transparent;
}
</style>

<style>
.area-shift-dialog-mask.p-dialog-mask {
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.p-dialog.area-shift-dialog .p-dialog-content,
.area-shift-dialog-content.p-dialog-content {
  padding: 0 10px !important;
}

.area-filter-datepicker-panel.p-datepicker-panel {
  z-index: 1300 !important;
}
</style>