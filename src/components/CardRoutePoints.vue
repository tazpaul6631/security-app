<template>
    <div class="points-grid">
        <div v-for="(point, idx) in details" :key="point.rdId" class="grid-item-wrapper">
            <div class="point-node" :class="{
                'done': point.status === 1,
                'next-step': isCurrentStep(idx)
            }">
                <div class="mini-thumb">
                    <ion-icon class="points-icon" :icon="libraryOutline"></ion-icon>

                    <div v-if="point.status === 1" class="check-icon">
                        <ion-icon :icon="checkmark"></ion-icon>
                    </div>

                    <div v-if="getOfflineCount(point.cpId) > 0" class="offline-badge">
                        <ion-icon :icon="cloudOfflineOutline"></ion-icon>
                    </div>
                </div>
                <span class="point-number" :class="{
                    'done': point.status === 1
                }">{{ point.cpPriority }}</span>
            </div>

            <div v-if="(idx + 1) % 4 !== 0 && idx !== details.length - 1" class="h-line"
                :class="{ 'active': point.status === 1 }">
            </div>

            <div class="point-label">{{ point.cpName }}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { checkmark, cloudOfflineOutline, libraryOutline } from 'ionicons/icons';
import { IonIcon, onIonViewWillEnter } from '@ionic/vue';
import storageService from '@/services/storage.service';
import { useStore } from 'vuex';

const store = useStore();

// 1. Định nghĩa Interface cho Props
interface RouteDetail {
    rdId: number | string;
    cpId: number | string;
    cpName: string;
    status: number;
    cpPriority: number;
}

const props = defineProps<{
    details: RouteDetail[]
}>();

// 2. Biến lưu trữ số lượng báo cáo offline: Object map { cpId: count }
const offlineCounts = ref<Record<string, number>>({});

// 3. Hàm tính toán số lượng báo cáo bị kẹt theo từng điểm
const loadOfflineQueue = async () => {
    try {
        const queue = (await storageService.get('offline_api_queue')) || [];
        const counts: Record<string, number> = {};

        // Lấy psId của ca trực đang active hiện tại
        const currentPsId = store.state.psId;

        queue.forEach((item: any) => {
            // Chỉ cộng dồn nếu cpId tồn tại VÀ psId phải khớp với ca hiện tại
            if (item.data && item.data.cpId && Number(item.data.psId) === Number(currentPsId)) {
                const cpId = String(item.data.cpId);
                counts[cpId] = (counts[cpId] || 0) + (item.data.reports?.length || 1);
            }
        });

        offlineCounts.value = counts;
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu offline queue:', error);
    }
};

// Hàm tiện ích để hiển thị số lượng trên template
const getOfflineCount = (cpId: number | string): number => {
    return offlineCounts.value[String(cpId)] || 0;
};

// Kiểm tra điểm kế tiếp
const isCurrentStep = (index: number): boolean => {
    if (!props.details) return false;
    const firstIncomplete = props.details.findIndex((p: RouteDetail) => p.status !== 1);
    return index === firstIncomplete;
};

// 4. Lấy dữ liệu khi Component vừa được tạo
onMounted(() => {
    loadOfflineQueue();
});

// Load lại dữ liệu mỗi khi quay lại trang này (nếu Component nằm trong IonPage)
onIonViewWillEnter(() => {
    loadOfflineQueue();
});

// Cho phép component cha gọi lại hàm này để cập nhật (Tùy chọn)
defineExpose({ loadOfflineQueue });
</script>

<style scoped>
.points-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px 5px;
    padding: 0 0 15px 0;
}

.grid-item-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
}

.point-node {
    width: 50px;
    height: 50px;
    position: relative;
    border-radius: 12px;
    padding: 2px;
    border: 2px solid #e0e0e0;
    transition: all 0.3s ease;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.point-node.done {
    border-color: var(--ion-color-success);
    background: #f6ffed;
}

.point-node.next-step {
    border-color: var(--ion-color-warning);
    border-style: dashed;
    animation: pulse-orange 2s infinite;
}

.point-number {
    position: absolute;
    bottom: -9px;
    right: -13px;
    background: #999;
    color: white;
    font-size: 13px;
    padding-top: 1px;
    width: 23px;
    border-radius: 12px;
    border: 1.5px solid white;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.point-number.done {
    background: var(--ion-color-success);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.point-node.next-step .point-number {
    background: var(--ion-color-warning);
}

.points-icon {
    font-size: 35px;
    color: #ccc;
}

.point-node.done .points-icon {
    color: var(--ion-color-success);
}

/* --- CẬP NHẬT Ở ĐÂY --- */
.check-icon {
    position: absolute;
    top: -10px;
    right: -10px;
    background: var(--ion-color-success);
    border-radius: 50%;
    color: white;
    display: flex;
    padding: 2px;
    font-size: 12px;
    border: 1.5px solid white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* Badge cảnh báo Offline */
.offline-badge {
    position: absolute;
    bottom: -8px;
    left: -11px;
    background: var(--ion-color-warning);
    color: white;
    font-size: 12px;
    font-weight: bold;
    padding: 3px;
    border-radius: 10px;
    border: 1.5px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.point-label {
    margin-top: 8px;
    font-size: 0.7rem;
    color: #444;
    text-align: center;
    /* display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.2; */
    max-width: 65px;
    height: 1.5rem;
}

.h-line {
    background: #eee;
    position: absolute;
    top: 25px;
    right: -28%;
    width: 50%;
    height: 2px;
    z-index: 0;
}

.h-line.active {
    background: var(--ion-color-success);
}

@keyframes pulse-orange {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.4);
        transform: scale(1);
    }

    70% {
        box-shadow: 0 0 0 8px rgba(255, 152, 0, 0);
        transform: scale(1.05);
    }

    100% {
        box-shadow: 0 0 0 0 rgba(255, 152, 0, 0);
        transform: scale(1);
    }
}
</style>