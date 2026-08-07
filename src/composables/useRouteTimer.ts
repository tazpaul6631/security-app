import { ref, computed } from 'vue';
import storageService from '@/services/storage.service';
import { speakText } from '@/services/ttsService';

// SINGLETON STATE
const remainingSeconds = ref(0);
const minThreshold = ref(0);
const isTimerRunning = ref(false);
let intervalId: any = null;
let hasSpokenMinWarning = false;
/** Khóa routeId_psId đang startTimer — chặn restoreTimer clear UI giữa chừng */
let startingTimerKey: string | null = null;
const currentTimerRouteId = ref<string | number | null>(null);
const currentTimerPsId = ref<string | number | null>(null);

const timerKeyOf = (routeId: string | number, psId: string | number) => `${routeId}_${psId}`;

const maybeSpeakMinWarning = (secondsLeft: number) => {
  if (minThreshold.value <= 0 || hasSpokenMinWarning) return;
  if (secondsLeft > minThreshold.value) return;

  hasSpokenMinWarning = true;
  // const minutes = Math.floor(minThreshold.value / 60);
  void speakText(`Vui lòng hoàn tất ca trực trước giờ quy định để bắt đầu ca trực mới`);
};

/** Ẩn UI timer trong RAM — không đụng storage */
const hideTimerUi = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isTimerRunning.value = false;
  hasSpokenMinWarning = false;
  remainingSeconds.value = 0;
  minThreshold.value = 0;
  currentTimerRouteId.value = null;
  currentTimerPsId.value = null;
};

const stopTimer = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isTimerRunning.value = false;
};

export function useRouteTimer() {

  const startTimer = async (routeId: string | number, psId: string | number, planMaxSecond: number, planMinSecond: number = 0) => {
    if (isTimerRunning.value && currentTimerRouteId.value === routeId && currentTimerPsId.value === psId) return;

    const key = timerKeyOf(routeId, psId);
    startingTimerKey = key;

    try {
      // Đổi ca / lộ trình → bỏ state UI cũ trước khi gắn timer mới
      if (
        currentTimerRouteId.value !== null &&
        (Number(currentTimerRouteId.value) !== Number(routeId) || Number(currentTimerPsId.value) !== Number(psId))
      ) {
        hideTimerUi();
      }

      hasSpokenMinWarning = false;
      currentTimerRouteId.value = routeId;
      currentTimerPsId.value = psId;
      minThreshold.value = planMinSecond;

      const savedEndTime = await storageService.get(`timer_end_${key}`);
      // restoreTimer có thể xen giữa await — gắn lại UI cho đúng ca đang start
      currentTimerRouteId.value = routeId;
      currentTimerPsId.value = psId;
      minThreshold.value = planMinSecond;

      const now = Math.floor(Date.now() / 1000);
      let endTime = 0;

      if (savedEndTime) {
        remainingSeconds.value = Math.max(0, savedEndTime - now);
        endTime = savedEndTime;
      } else {
        remainingSeconds.value = planMaxSecond;
        endTime = now + planMaxSecond;
        await storageService.set(`timer_end_${key}`, endTime);
        currentTimerRouteId.value = routeId;
        currentTimerPsId.value = psId;
        minThreshold.value = planMinSecond;
        remainingSeconds.value = Math.max(0, endTime - Math.floor(Date.now() / 1000));
      }

      await storageService.set(`timer_min_${key}`, planMinSecond);
      currentTimerRouteId.value = routeId;
      currentTimerPsId.value = psId;
      minThreshold.value = planMinSecond;

      maybeSpeakMinWarning(remainingSeconds.value);

      isTimerRunning.value = true;
      if (intervalId) clearInterval(intervalId);

      if (remainingSeconds.value > 0) {
        intervalId = setInterval(() => {
          const currentNow = Math.floor(Date.now() / 1000);
          const diff = endTime - currentNow;

          if (diff > 0) {
            remainingSeconds.value = diff;
            maybeSpeakMinWarning(diff);
          } else {
            remainingSeconds.value = 0;
            stopTimer();
          }
        }, 1000);
      } else {
        stopTimer();
      }
    } finally {
      if (startingTimerKey === key) {
        startingTimerKey = null;
      }
    }
  };

  const restoreTimer = async (routeId: string | number, psId: string | number) => {
    const key = timerKeyOf(routeId, psId);

    // Đang startTimer cùng ca → không đụng UI (tránh mất countdown lần quét đầu)
    if (startingTimerKey === key) return;

    if (isTimerRunning.value && currentTimerRouteId.value === routeId && currentTimerPsId.value === psId) return;

    const savedEndTime = await storageService.get(`timer_end_${key}`);
    const savedMin = await storageService.get(`timer_min_${key}`);

    // Có thể startTimer vừa ghi xong trong lúc await trên
    if (startingTimerKey === key) return;
    if (isTimerRunning.value && currentTimerRouteId.value === routeId && currentTimerPsId.value === psId) return;

    if (!savedEndTime) {
      // Chỉ clear khi UI đang hiện ca KHÁC — không xóa ca đang start / cùng ca chưa kịp persist
      const showingOtherShift =
        currentTimerRouteId.value !== null &&
        (Number(currentTimerRouteId.value) !== Number(routeId) ||
          Number(currentTimerPsId.value) !== Number(psId));
      if (showingOtherShift) {
        hideTimerUi();
      }
      return;
    }

    hasSpokenMinWarning = false;
    minThreshold.value = savedMin || 0;
    const now = Math.floor(Date.now() / 1000);

    currentTimerRouteId.value = routeId;
    currentTimerPsId.value = psId;

    if (savedEndTime > now) {
      remainingSeconds.value = savedEndTime - now;
      maybeSpeakMinWarning(remainingSeconds.value);
      isTimerRunning.value = true;
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        const currentNow = Math.floor(Date.now() / 1000);
        const diff = savedEndTime - currentNow;

        if (diff > 0) {
          remainingSeconds.value = diff;
          maybeSpeakMinWarning(diff);
        } else {
          remainingSeconds.value = 0;
          stopTimer();
        }
      }, 1000);
    } else {
      remainingSeconds.value = 0;
      stopTimer();
    }
  };

  const clearTimer = async (routeId?: string | number | null, psId?: string | number | null) => {
    const targetRouteId = routeId ?? currentTimerRouteId.value;
    const targetPsId = psId ?? currentTimerPsId.value;

    // RouteIndex có thể clear ca mới đang startTimer (điểm đầu) — bỏ qua để giữ countdown
    if (
      targetRouteId != null &&
      targetPsId != null &&
      startingTimerKey === timerKeyOf(targetRouteId, targetPsId)
    ) {
      return;
    }

    hideTimerUi();

    if (targetRouteId != null && targetPsId != null) {
      const key = timerKeyOf(targetRouteId, targetPsId);
      await storageService.remove(`timer_end_${key}`);
      await storageService.remove(`timer_min_${key}`);
    }
  };

  const timerColorClass = computed(() => {
    if (currentTimerRouteId.value === null) return '';
    if (remainingSeconds.value <= minThreshold.value) return 'text-danger';
    return 'text-success';
  });

  return {
    remainingSeconds,
    formattedTime: computed(() => {
      if (currentTimerRouteId.value === null) return '';
      if (remainingSeconds.value <= 0) return '00:00';
      const m = Math.floor(remainingSeconds.value / 60);
      const s = remainingSeconds.value % 60;
      return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    }),
    timerColorClass,
    startTimer,
    stopTimer,
    clearTimer,
    restoreTimer,
    currentTimerRouteId,
    currentTimerPsId
  };
}
