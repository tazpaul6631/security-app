import { ref, computed } from 'vue';
import storageService from '@/services/storage.service';

// SINGLETON STATE
const remainingSeconds = ref(0);
const minThreshold = ref(0);
const isTimerRunning = ref(false);
let intervalId: any = null;
const currentTimerRouteId = ref<string | number | null>(null);
const currentTimerPsId = ref<string | number | null>(null); // THÊM STATE LƯU psId

export function useRouteTimer() {

  // 1. Thêm tham số psId vào startTimer
  const startTimer = async (routeId: string | number, psId: string | number, planMaxSecond: number, planMinSecond: number = 0) => {
    if (isTimerRunning.value && currentTimerRouteId.value === routeId && currentTimerPsId.value === psId) return;

    currentTimerRouteId.value = routeId;
    currentTimerPsId.value = psId;
    minThreshold.value = planMinSecond;

    // GHÉP KEY MỚI
    const timerKey = `${routeId}_${psId}`;
    const savedEndTime = await storageService.get(`timer_end_${timerKey}`);
    const now = Math.floor(Date.now() / 1000);

    let endTime = 0;

    if (savedEndTime) {
      remainingSeconds.value = Math.max(0, savedEndTime - now);
      endTime = savedEndTime;
    } else {
      remainingSeconds.value = planMaxSecond;
      endTime = now + planMaxSecond;
      await storageService.set(`timer_end_${timerKey}`, endTime);
    }

    await storageService.set(`timer_min_${timerKey}`, planMinSecond);

    isTimerRunning.value = true;
    if (intervalId) clearInterval(intervalId);

    if (remainingSeconds.value > 0) {
      intervalId = setInterval(() => {
        const currentNow = Math.floor(Date.now() / 1000);
        const diff = endTime - currentNow;

        if (diff > 0) {
          remainingSeconds.value = diff;
        } else {
          remainingSeconds.value = 0;
          stopTimer();
        }
      }, 1000);
    } else {
      stopTimer();
    }
  };

  // 2. Thêm tham số psId vào restoreTimer
  const restoreTimer = async (routeId: string | number, psId: string | number) => {
    if (isTimerRunning.value && currentTimerRouteId.value === routeId && currentTimerPsId.value === psId) return;

    // GHÉP KEY MỚI
    const timerKey = `${routeId}_${psId}`;
    const savedEndTime = await storageService.get(`timer_end_${timerKey}`);
    const savedMin = await storageService.get(`timer_min_${timerKey}`);

    if (savedEndTime) {
      minThreshold.value = savedMin || 0;
      const now = Math.floor(Date.now() / 1000);

      currentTimerRouteId.value = routeId;
      currentTimerPsId.value = psId;

      if (savedEndTime > now) {
        remainingSeconds.value = savedEndTime - now;
        isTimerRunning.value = true;
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(() => {
          const currentNow = Math.floor(Date.now() / 1000);
          const diff = savedEndTime - currentNow;

          if (diff > 0) {
            remainingSeconds.value = diff;
          } else {
            remainingSeconds.value = 0;
            stopTimer();
          }
        }, 1000);
      } else {
        remainingSeconds.value = 0;
        stopTimer();
      }
    }
  };

  // 3. Thêm tham số psId vào clearTimer
  const clearTimer = async (routeId?: string | number | null, psId?: string | number | null) => {
    const targetRouteId = routeId || currentTimerRouteId.value;
    const targetPsId = psId || currentTimerPsId.value;

    stopTimer();
    remainingSeconds.value = 0;
    minThreshold.value = 0;
    currentTimerRouteId.value = null;
    currentTimerPsId.value = null;

    if (targetRouteId && targetPsId) {
      const timerKey = `${targetRouteId}_${targetPsId}`;
      await storageService.remove(`timer_end_${timerKey}`);
      await storageService.remove(`timer_min_${timerKey}`);
    }
  };

  const stopTimer = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isTimerRunning.value = false;
  };

  const timerColorClass = computed(() => {
    if (currentTimerRouteId.value === null) return '';
    if (remainingSeconds.value <= minThreshold.value) {
      return 'text-danger';
    }
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