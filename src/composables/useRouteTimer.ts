import { ref, computed } from 'vue';
import storageService from '@/services/storage.service';

// 1. ĐẶT BIẾN Ở NGOÀI export ĐỂ TẠO SINGLETON (STATE DÙNG CHUNG TOÀN APP)
const remainingSeconds = ref(0);
const isTimerRunning = ref(false);
let intervalId: any = null;
const currentTimerRouteId = ref<string | number | null>(null);

export function useRouteTimer() {

    const startTimer = async (routeId: string | number, planSecond: number) => {
        // Nếu đang chạy đúng lộ trình này rồi thì không chạy lại (tránh loạn nhịp)
        if (isTimerRunning.value && currentTimerRouteId.value === routeId) return;

        // Lưu routeId hiện tại
        currentTimerRouteId.value = routeId;

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

        // Bắt đầu đếm nếu còn thời gian
        if (remainingSeconds.value > 0) {
            intervalId = setInterval(() => {
                if (remainingSeconds.value > 0) {
                    remainingSeconds.value--;
                } else {
                    // Chạm 0 thì dừng, NHƯNG KHÔNG CLEAR TIMER
                    stopTimer();
                }
            }, 1000);
        } else {
            stopTimer(); // Đã hết giờ từ trước
        }
    };

    const restoreTimer = async (routeId: string | number) => {
        if (isTimerRunning.value && currentTimerRouteId.value === routeId) return;

        const savedEndTime = await storageService.get(`timer_end_${routeId}`);
        if (savedEndTime) {
            const now = Math.floor(Date.now() / 1000);
            if (savedEndTime > now) {
                currentTimerRouteId.value = routeId;
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
                // Ghim id và ép giây về 0 để giữ hiển thị 00:00 chớp đỏ
                currentTimerRouteId.value = routeId;
                remainingSeconds.value = 0;
                stopTimer();
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
        currentTimerRouteId.value = null; // Gỡ ghim ID để ẩn giao diện
        await storageService.remove(`timer_end_${routeId}`);
    };

    // Format thời gian MM:SS
    const formattedTime = computed(() => {
        // Chỉ ẩn đi khi thực sự không có RouteId nào được ghim
        if (currentTimerRouteId.value === null) return '';

        // Đóng băng ở 00:00 nếu hết giờ
        if (remainingSeconds.value <= 0) return '00:00';

        const m = Math.floor(remainingSeconds.value / 60);
        const s = remainingSeconds.value % 60;
        return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    });

    // Màu sắc chung
    const timerColorClass = computed(() => {
        // Thêm .value cho currentTimerRouteId
        if (currentTimerRouteId.value === null) return '';

        // <= 600 bao gồm cả số 0, nên khi 00:00 nó sẽ ăn class 'text-danger' và chớp đỏ liên tục
        if (remainingSeconds.value <= 600) {
            return 'text-danger';
        }
        return 'text-success';
    });

    return {
        remainingSeconds,
        isTimerRunning,
        formattedTime,
        timerColorClass,
        startTimer,
        stopTimer,
        clearTimer,
        restoreTimer,
        currentTimerRouteId
    };
}