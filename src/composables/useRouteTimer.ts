import { ref, computed } from 'vue';
import storageService from '@/services/storage.service';

// SINGLETON STATE
const remainingSeconds = ref(0);
const minThreshold = ref(0);
const isTimerRunning = ref(false);
let intervalId: any = null;
const currentTimerRouteId = ref<string | number | null>(null);

export function useRouteTimer() {

    // Thêm tham số planMinSecond vào hàm start
    const startTimer = async (routeId: string | number, planMaxSecond: number, planMinSecond: number = 0) => {
        if (isTimerRunning.value && currentTimerRouteId.value === routeId) return;

        currentTimerRouteId.value = routeId;
        minThreshold.value = planMinSecond;

        const savedEndTime = await storageService.get(`timer_end_${routeId}`);
        const now = Math.floor(Date.now() / 1000);

        let endTime = 0;

        if (savedEndTime) {
            remainingSeconds.value = Math.max(0, savedEndTime - now);
            endTime = savedEndTime;
        } else {
            remainingSeconds.value = planMaxSecond;
            endTime = now + planMaxSecond;
            await storageService.set(`timer_end_${routeId}`, endTime);
        }

        // Lưu luôn cả planMinSecond vào storage để khi reload app vẫn nhớ mốc đỏ
        await storageService.set(`timer_min_${routeId}`, planMinSecond);

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

    const restoreTimer = async (routeId: string | number) => {
        if (isTimerRunning.value && currentTimerRouteId.value === routeId) return;

        const savedEndTime = await storageService.get(`timer_end_${routeId}`);
        const savedMin = await storageService.get(`timer_min_${routeId}`);

        if (savedEndTime) {
            minThreshold.value = savedMin || 0;
            const now = Math.floor(Date.now() / 1000);

            currentTimerRouteId.value = routeId;
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

    const clearTimer = async (routeId?: string | number | null) => {
        const targetId = routeId || currentTimerRouteId.value;

        stopTimer();
        remainingSeconds.value = 0;
        minThreshold.value = 0;
        currentTimerRouteId.value = null;

        if (targetId) {
            await storageService.remove(`timer_end_${targetId}`);
            await storageService.remove(`timer_min_${targetId}`);
        }
    };

    const stopTimer = () => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        isTimerRunning.value = false;
    };

    // LOGIC ĐỔI MÀU DỰA TRÊN planMinSecond
    const timerColorClass = computed(() => {
        if (currentTimerRouteId.value === null) return '';

        // Nếu giây còn lại ít hơn hoặc bằng mốc tối thiểu -> Chuyển Đỏ
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
        currentTimerRouteId
    };
}