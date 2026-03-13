import { ref, computed } from 'vue';
import storageService from '@/services/storage.service';

// 1. ĐẶT BIẾN Ở NGOÀI export ĐỂ TẠO SINGLETON (STATE DÙNG CHUNG TOÀN APP)
const remainingSeconds = ref(0);
const isTimerRunning = ref(false);
let intervalId: any = null;
let currentTimerRouteId: string | number | null = null;

export function useRouteTimer() {

    const startTimer = async (routeId: string | number, planSecond: number) => {
        // Nếu đang chạy đúng lộ trình này rồi thì không chạy lại (tránh loạn nhịp)
        if (isTimerRunning.value && currentTimerRouteId === routeId) return;

        // Lưu routeId hiện tại
        currentTimerRouteId = routeId;

        // Kiểm tra xem trước đó đã lưu thời gian kết thúc trong SQLite chưa (chống load lại app bị mất giờ)
        const savedEndTime = await storageService.get(`timer_end_${routeId}`);
        const now = Math.floor(Date.now() / 1000); // Đổi ra giây

        if (savedEndTime) {
            remainingSeconds.value = Math.max(0, savedEndTime - now);
        } else {
            remainingSeconds.value = planSecond;
            const endTime = now + planSecond;
            await storageService.set(`timer_end_${routeId}`, endTime); // Lưu vào local
        }

        isTimerRunning.value = true;

        if (intervalId) clearInterval(intervalId);

        intervalId = setInterval(() => {
            if (remainingSeconds.value > 0) {
                remainingSeconds.value--;
            } else {
                stopTimer();
            }
        }, 1000);
    };

    const restoreTimer = async (routeId: string | number) => {
        if (isTimerRunning.value && currentTimerRouteId === routeId) return;

        const savedEndTime = await storageService.get(`timer_end_${routeId}`);
        if (savedEndTime) {
            const now = Math.floor(Date.now() / 1000);
            if (savedEndTime > now) {
                currentTimerRouteId = routeId;
                remainingSeconds.value = savedEndTime - now;
                isTimerRunning.value = true;

                if (intervalId) clearInterval(intervalId);
                intervalId = setInterval(() => {
                    if (remainingSeconds.value > 0) {
                        remainingSeconds.value--;
                    } else {
                        stopTimer();
                    }
                }, 1000);
            } else {
                // Nếu quá giờ rồi thì dọn dẹp
                await clearTimer(routeId);
            }
        }
    };

    const stopTimer = () => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        isTimerRunning.value = false;
    };

    const clearTimer = async (routeId: string | number) => {
        stopTimer();
        remainingSeconds.value = 0;
        currentTimerRouteId = null;
        await storageService.remove(`timer_end_${routeId}`);
    };

    // Format thời gian MM:SS
    const formattedTime = computed(() => {
        // Nếu không có lộ trình nào hoặc đã dọn dẹp, trả về chuỗi trống hoặc "--:--"
        if (!currentTimerRouteId && remainingSeconds.value === 0) return '';

        const m = Math.floor(remainingSeconds.value / 60);
        const s = remainingSeconds.value % 60;
        return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    });

    // Màu sắc chung
    const timerColorClass = computed(() => {
        if (!isTimerRunning.value && currentTimerRouteId === null) return ''; // Chưa chạy -> Xám
        if (remainingSeconds.value <= 600) {
            return 'text-danger'; // Dưới 10 phút -> Đỏ
        }
        return 'text-success'; // Đang chạy -> Xanh
    });

    return {
        remainingSeconds,
        isTimerRunning,
        formattedTime,
        timerColorClass,
        startTimer,
        stopTimer,
        clearTimer,
        restoreTimer
    };
}