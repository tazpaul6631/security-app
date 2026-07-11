<template>
  <ion-page class="route-page">
    <header class="route-header">
      <button type="button" class="route-back-btn" :aria-label="$t('routes.go-home')" @click="router.replace('/home')">
        <i class="pi pi-arrow-left route-back-icon" aria-hidden="true" />
        <span class="route-title">{{ $t('page.routes') }}</span>
      </button>
    </header>

    <ion-content class="route-content" :class="{ 'route-content--locked': !isLoading && !!currentActiveRoute }">
      <div class="route-bg" aria-hidden="true">
        <span class="route-blob route-blob-green" />
        <span class="route-blob route-blob-purple" />
      </div>

      <div v-if="isLoading" class="loading-state">
        <ProgressSpinner stroke-width="2" />
        <p>{{ $t('routes.loading-route') }}</p>
      </div>

      <transition v-else name="fade-route" mode="out-in">
        <div v-if="currentActiveRoute" :key="currentActiveRoute.routeId" class="route-body">
          <Card class="route-card"
            :pt="{ body: { class: 'route-card-body' }, content: { class: 'route-card-content' } }">
            <template #title>
              <span class="route-name">{{ currentActiveRoute.routeName }}</span>
            </template>
            <template #subtitle>
              <div class="route-meta">
                <span>
                  {{ $t('routes.code') }} {{ currentActiveRoute.routeCode }} |
                  {{ $t('routes.shift') }} {{ currentActiveRoute.psHourFrom }}h -
                  {{ currentActiveRoute.psDay }}/{{ currentActiveRoute.psMonth }}/{{ currentActiveRoute.psYear }}
                </span>
                <span v-show="formattedTime" class="timer-display" :class="timerColorClass">
                  <i class="pi pi-clock icon-clock" />
                  {{ $t('routes.countdown') }} {{ formattedTime }}
                </span>
              </div>
            </template>
            <template #content>
              <div class="route-points-scroll">
                <card-route-points ref="cardRoutePointsRef" :details="currentActiveRoute.routeDetails" />
              </div>
            </template>
          </Card>
        </div>

        <div v-else class="no-route-container">
          <div class="no-route-content">
            <i class="pi pi-calendar big-icon" />

            <div v-if="hasDataButFinished">
              <h3>{{ $t('routes.txt-info', { currentHour: currentHour }) }}</h3>
              <p>{{ $t('routes.all-scanned') }}</p>
            </div>
            <div v-else>
              <h3>{{ $t('routes.route-not-found', { currentHour: currentHour }) }}</h3>
              <p>{{ $t('routes.no-shift-data') }}</p>
            </div>
            <Button :label="$t('routes.go-home')" severity="secondary" variant="outlined" icon="pi pi-home"
              class="go-home-btn" size="large" @click="router.replace('/home')" />
          </div>
        </div>
      </transition>

      <Dialog v-model:visible="isCancelAlertOpen" modal :header="$t('routes.warning-title')" class="cancel-route-dialog"
        :style="{ width: 'min(92vw, 22rem)' }" :draggable="false" :closable="false" :close-on-escape="!isCancelling"
        :dismissable-mask="!isCancelling">
        <p class="cancel-dialog-message">{{ $t('routes.cancel-confirm-msg') }}</p>
        <template #footer>
          <Button :label="$t('routes.cancel')" severity="secondary" variant="outlined" :disabled="isCancelling"
            size="large" @click="isCancelAlertOpen = false" />
          <Button :label="$t('routes.confirm-cancel')" icon="pi pi-trash" severity="danger" :loading="isCancelling"
            size="large" @click="handleCancelConfirm" />
        </template>
      </Dialog>

      <Dialog v-model:visible="isWrongOrderOpen" modal :header="$t('messages.scanner.wrong-patrol-order')"
        class="wrong-order-dialog" :style="{ width: 'min(92vw, 22rem)' }" :draggable="false" :closable="false">
        <p class="wrong-order-point">{{ wrongOrderPointName }}</p>
        <p class="wrong-order-message">{{ $t('messages.scanner.next-checkpoint') }}</p>
        <template #footer>
          <Button :label="$t('areas.report.close')" severity="secondary" variant="outlined" size="large"
            @click="isWrongOrderOpen = false" />
        </template>
      </Dialog>
    </ion-content>

    <footer v-if="!isLoading && currentActiveRoute" class="route-footer">
      <div class="active-controls">
        <Button v-if="canCancelRoute" :label="$t('routes.cancel')" icon="pi pi-trash" severity="danger"
          class="btn-cancel" size="large" @click="confirmCancelRoute" />
        <Button :label="isScanning ? $t('routes.opening-camera') : $t('routes.scan')" icon="pi pi-qrcode"
          severity="success" class="btn-continue" :loading="isScanning" :disabled="isScanning" size="large"
          @click="handleContinueScanning(currentActiveRoute.routeId)" />
      </div>
    </footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import {
  IonPage, IonContent, onIonViewWillEnter,
  useBackButton
} from '@ionic/vue';
import CardRoutePoints from '@/components/CardRoutePoints.vue';
import { Button, Card, Dialog, ProgressSpinner } from '@/plugins/primevue.components';
import { useAppLoading } from '@/composables/useAppLoading';
import { scannerService } from '@/services/scanner.service';
import storageService from '@/services/storage.service';
import PatrolShiftView from '@/api/PatrolShiftView';

// IMPORT GLOBAL TIMER
import { useRouteTimer } from '@/composables/useRouteTimer';
import PatrolShift from '@/api/PatrolShift';
import { useOfflineManager } from '@/composables/useOfflineManager';
import { useI18n } from 'vue-i18n';

// Lấy biến và hàm từ Global Timer ra sử dụng
const { formattedTime, timerColorClass, clearTimer, restoreTimer, stopTimer, remainingSeconds, currentTimerRouteId, currentTimerPsId } = useRouteTimer();

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
  psDay: number;
  psMonth: number;
  psYear: number;
  routeDetails: RouteDetail[];
  areaId: number;
  roleId: number;
  psId: number;
  isComplete?: boolean;
}

const store = useStore();
const router = useRouter();
const isCancelAlertOpen = ref(false);
const isWrongOrderOpen = ref(false);
const wrongOrderPointName = ref('');
const isLoading = ref(true);
const isScanning = ref(false);
const userRoleIsAdmin = ref();

// const shiftDataList = ref<Route[]>([]);
const shiftDataList = computed<Route[]>(() => store.state.dataListRoute || []);
const currentHour = ref(new Date().getHours());
let timer: any = null;
const lockedRouteId = computed(() => store.state.unfinishedRouteId);
const { t } = useI18n();
const { show: showLoading, hide: hideLoading } = useAppLoading();
const cardRoutePointsRef = ref<any>(null);
const { pendingItems, loadPendingItems, cleanUpItem, purgeStaleShiftQueue } = useOfflineManager();

const canCancelRoute = computed(() => {
  const user = store.state.dataUser;
  const userCode = user?.userCode || user?.data?.userCode;
  return userCode === 'R39557';
});

// ==========================================
// 1. KHAI BÁO LỘ TRÌNH HIỆN TẠI
// ==========================================
const currentActiveRoute = computed(() => {
  const routes = shiftDataList.value;
  const userData = store.state.dataUser;
  const lockedPsId = store.state.psId;

  if (!userData || !Array.isArray(routes)) return null;

  const uRole = Number(userData.userRoleId);
  const uArea = Number(userData.userAreaId);

  // --- LẤY NGÀY GIỜ HỆ THỐNG HIỆN TẠI ---
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const hNow = currentHour.value; // Biến giờ bạn đã theo dõi bằng setInterval

  // ƯU TIÊN 1: Lộ trình đang làm dở (Bị khóa - Không quan tâm quá giờ)
  if (lockedRouteId.value !== null) {
    let lockedRoute;
    if (lockedPsId) {
      lockedRoute = routes.find((r: any) =>
        Number(r.routeId) === Number(lockedRouteId.value) &&
        Number(r.psId) === Number(lockedPsId)
      );
    }

    if (lockedRoute) {
      const isFinished = lockedRoute.routeDetails.every((p: any) => p.rdIsComplete);
      if (!isFinished) return { ...lockedRoute };
    }
  }

  // ƯU TIÊN 2: Tìm lộ trình mới theo KHUNG GIỜ VÀ NGÀY THÁNG hiện tại
  const foundRoute = routes.find((r: any) => {
    // Sai Khu vực hoặc Sai Quyền -> Bỏ qua
    if (Number(r.areaId) !== uArea || Number(r.roleId) !== uRole) return false;

    const f = Number(r.psHourFrom);
    const t = Number(r.psHourTo);

    // Kiểm tra xem ca trực này có thuộc "Ngày Hôm Nay" không
    const isToday = (
      Number(r.psYear) === currentYear &&
      Number(r.psMonth) === currentMonth &&
      Number(r.psDay) === currentDay
    );

    let isMatchDateAndHour = false;

    // TRƯỜNG HỢP 1: Ca trong ngày (psHourFrom <= psHourTo, vd: 8h->16h hoặc 23h->23h)
    if (f <= t) {
      isMatchDateAndHour = isToday && (hNow >= f && hNow <= t);
    }
    // TRƯỜNG HỢP 2: Ca qua đêm (psHourFrom > psHourTo, vd: 22h->06h)
    else {
      if (hNow >= f) {
        // Nếu đang là 23h đêm (trước 00:00), thì nó phải thuộc ngày hôm nay
        isMatchDateAndHour = isToday;
      } else if (hNow <= t) {
        // Nếu đang là 2h sáng (sau 00:00), thì ca trực này bản chất được bắt đầu từ NGÀY HÔM QUA
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);

        const isYesterday = (
          Number(r.psYear) === yesterday.getFullYear() &&
          Number(r.psMonth) === yesterday.getMonth() + 1 &&
          Number(r.psDay) === yesterday.getDate()
        );
        isMatchDateAndHour = isYesterday;
      }
    }

    // Kiểm tra xem ca đã hoàn thành chưa
    const isFinished = r.routeDetails.every((p: any) => p.rdIsComplete);

    // Bắt buộc phải khớp (Ngày + Giờ) và chưa hoàn thành
    return isMatchDateAndHour && !isFinished && !r.isComplete;
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
    await purgeStaleShiftQueue(newRoute.psId);
    await loadPendingItems();
  }

  if (newRoute) {
    // 1. Kiểm tra xem ca này đã có điểm nào quét chưa (status = 1)
    const hasStarted = newRoute.routeDetails.some((p: any) => p.rdIsComplete);

    // 2. Hoặc kiểm tra xem nó có đang bị khóa dở dang không
    const isUnfinished = Number(newRoute.routeId) === Number(lockedRouteId.value);

    // CHỈ KHÔI PHỤC NẾU THỰC SỰ ĐÃ BẮT ĐẦU LÀM
    if (hasStarted || isUnfinished) {
      await restoreTimer(newRoute.routeId, newRoute.psId);
    } else {
      // CA MỚI TINH (Chưa làm gì) ---
      // NẾU đang có timer chạy VÀ (Khác Lộ trình HOẶC Khác Ca trực) -> Thì xóa timer cũ đi
      if (
        currentTimerRouteId.value !== null &&
        (currentTimerRouteId.value !== newRoute.routeId || currentTimerPsId.value !== newRoute.psId)
      ) {
        // Xóa timer bằng khóa của ca CŨ
        await clearTimer(currentTimerRouteId.value, currentTimerPsId.value);
      }
    }
  } else {
    // NẾU KHÔNG CÓ LỘ TRÌNH NÀO HOẠT ĐỘNG
    // Tránh tình trạng clear nhầm Storage lúc API đang load làm currentActiveRoute bị null tạm thời
    if (!lockedRouteId.value && !isLoading.value) {
      if (currentTimerRouteId.value !== null) {
        await clearTimer(currentTimerRouteId.value, currentTimerPsId.value);
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

  showLoading(t('routes.verifying-checkpoint'));

  try {
    const result = await scannerService.processQRString(store, router, routeId, qrCodeString, t);
    if (result?.code === 'WRONG_ORDER') {
      wrongOrderPointName.value = result.nextPointName;
      isWrongOrderOpen.value = true;
    }
  } catch (error) {
    console.error("Lỗi xử lý dữ liệu quét:", error);
  } finally {
    hideLoading();
  }
};

// Nút bấm cho Điện thoại thường (Mở Camera)
const handleContinueScanning = async (routeId: number) => {
  if (isScanning.value) return;

  isScanning.value = true;

  const failSafeTimer = setTimeout(() => {
    if (isScanning.value) {
      isScanning.value = false;
      console.warn("Cảnh báo: Phản hồi mở Camera quá chậm, tự động nhả khóa!");
    }
  }, 5000);

  try {
    const result = await scannerService.startScanning(store, router, routeId, t);
    if (result) {
      await processScannedData(result, routeId);
    }
  } catch (error: any) {
    const errStr = String(error).toLowerCase();
    if (errStr.includes('canceled') || errStr.includes('user canceled')) {
      return;
    }
  } finally {
    clearTimeout(failSafeTimer);
    isScanning.value = false;
  }
};

const hasDataButFinished = computed(() => {
  const routes = shiftDataList.value;
  if (!Array.isArray(routes)) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const hNow = currentHour.value;

  const routeInHour = routes.find((r: any) => {
    const f = Number(r.psHourFrom);
    const t = Number(r.psHourTo);

    const isToday = (
      Number(r.psYear) === currentYear &&
      Number(r.psMonth) === currentMonth &&
      Number(r.psDay) === currentDay
    );

    if (f <= t) {
      return isToday && (hNow >= f && hNow <= t);
    } else {
      if (hNow >= f) return isToday;
      if (hNow <= t) {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return (
          Number(r.psYear) === yesterday.getFullYear() &&
          Number(r.psMonth) === yesterday.getMonth() + 1 &&
          Number(r.psDay) === yesterday.getDate()
        );
      }
      return false;
    }
  });

  if (routeInHour) {
    return routeInHour.isComplete || routeInHour.routeDetails.every((p: any) => p.rdIsComplete);
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

  // if (!store.state.isOnline) {
  //   shiftDataList.value = store.state.dataListRoute || [];
  // } else {
  //   try {
  //     const userData = store.state.dataUser?.data || store.state.dataUser || {};
  //     const areaId = userData.userAreaId;

  //     const now = new Date();
  //     const currentHour = now.getHours();
  //     const hoursArray = [];
  //     for (let i = currentHour; i <= 23; i++) {
  //       hoursArray.push(i);
  //     }
  //     const dateInfo = {
  //       psDay: now.getDate(),
  //       psMonth: now.getMonth() + 1,
  //       psYear: now.getFullYear(),
  //       userAreaId: areaId,
  //       psHours: hoursArray
  //     };

  //     const response: any = await PatrolShiftView.postPatrolShiftView(dateInfo);
  //     const apiDataRaw = response?.data?.data || response?.data || [];

  //     // Vuex sẽ kiểm tra xem ca bị khóa đã isComplete chưa, nếu có nó sẽ TỰ MỞ KHÓA
  //     store.commit('SET_DATA_LIST_ROUTE', apiDataRaw);

  //     shiftDataList.value = store.state.dataListRoute;
  //     await storageService.set('list_route', store.state.dataListRoute);

  //   } catch (error) {
  //     shiftDataList.value = store.state.dataListRoute || [];
  //   }
  // }

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

const handleCancelConfirm = async () => {
  if (isCancelling.value) return;
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

    await clearTimer(currentRoute.routeId, currentRoute.psId);
    await loadPendingItems();

    const itemsToDelete = pendingItems.value.filter(
      (item: any) => item.data.psId === currentRoute.psId
    );

    for (const item of itemsToDelete) {
      await cleanUpItem(item);
    }

    try {
      await PatrolShift.postRemovePatrolShift(removeData);
    } catch (error) {
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

    await store.dispatch('resetCurrentRoute');
    isCancelAlertOpen.value = false;
    router.replace('/home');
  } finally {
    isCancelling.value = false;
  }
};

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
.route-page {
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

.route-content {
  flex: 1;
  min-height: 0;
  --background: #d1e5e6;
}

.route-content::part(scroll) {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0
}

.route-content--locked {
  --overflow: hidden;
}

.route-content--locked::part(scroll) {
  overflow: hidden;
}

.route-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.route-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(72px);
  -webkit-filter: blur(72px);
  opacity: 0.9;
}

.route-blob-green {
  width: 250px;
  height: 250px;
  background: #e3f7ac;
  top: 20%;
  right: -50px;
}

.route-blob-purple {
  width: 250px;
  height: 250px;
  background: #cac2e9;
  bottom: 10%;
  left: -80px;
}

.route-body {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.loading-state {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
  color: #64748b;
}

.loading-state p {
  margin: 0;
  font-size: 0.875rem;
}

.route-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  background: #ffffff;
}

.route-card :deep(.p-card) {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.route-card :deep(.route-card-body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.route-card :deep(.p-card-caption) {
  flex-shrink: 0;
  padding: 0 10px;
}

.route-card :deep(.route-card-content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.route-points-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  align-content: flex-start;
}

.route-card :deep(.p-card-body) {
  padding: 10px;
}

.route-card :deep(.p-card-title) {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
}

.route-name {
  line-height: 1.3;
}

.route-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.875rem;
  color: #64748b;
  line-height: 1.45;
}

.timer-display {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  color: #64748b;
  transition: color 0.3s ease;
}

.icon-clock {
  font-size: 0.95rem;
}

.text-success {
  color: #16a34a;
  font-weight: 600;
}

.text-danger {
  color: #dc2626;
  font-weight: 600;
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

.route-footer {
  flex-shrink: 0;
  padding: 0 16px 49px 16px;
  background: #d1e5e6;
  border-top: 1px solid #e2e8f0;
  box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.04);
}

.active-controls {
  display: flex;
  gap: 12px;
}

.btn-cancel,
.btn-continue {
  flex: 1;
  min-height: 3.5rem;
  font-weight: 600;
  border-radius: 12px;
}

.cancel-dialog-message {
  margin: 0;
  color: #475569;
  font-size: 0.95rem;
  line-height: 1.5;
}

.cancel-route-dialog :deep(.p-dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.wrong-order-point {
  margin: 0 0 8px;
  font-size: 1.05rem;
  font-weight: 700;
  color: #dc2626;
  line-height: 1.4;
}

.wrong-order-message {
  margin: 0;
  color: #475569;
  font-size: 0.95rem;
  line-height: 1.5;
}

.wrong-order-dialog :deep(.p-dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.no-route-container {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  padding: 24px;
  margin: auto;
}

.no-route-content {
  max-width: 360px;
  text-align: center;
  color: #475569;
}

.no-route-content h3 {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}

.no-route-content p {
  margin: 0 0 20px;
  font-size: 0.9rem;
  line-height: 1.5;
}

.big-icon {
  font-size: 4rem;
  color: #cbd5e1;
  margin-bottom: 16px;
}

.go-home-btn {
  border-radius: 12px;
}

.fade-route-enter-active,
.fade-route-leave-active {
  transition: all 0.4s ease;
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.fade-route-enter-from {
  opacity: 0;
  transform: translateY(15px);
}

.fade-route-leave-to {
  opacity: 0;
  transform: translateY(-15px);
}
</style>