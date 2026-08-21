<template>
  <div class="points-grid">
    <div v-for="(point, idx) in details" :key="point.rdId" class="grid-item-wrapper">
      <div class="point-node" :class="{
        done: point.status === 1,
        'next-step': isCurrentStep(idx),
      }">
        <div class="mini-thumb">
          <i class="pi pi-map-marker points-icon" aria-hidden="true" />

          <Badge v-if="point.status === 1" severity="success" class="check-badge">
            <i class="pi pi-check" aria-hidden="true" />
          </Badge>

          <span v-if="getOfflineCount(point.cpId) > 0" class="sync-badge" title="Chờ đồng bộ">
            <i class="pi pi-cloud-upload sync-icon" aria-hidden="true" />
          </span>
        </div>

        <Tag :value="String(point.cpPriority)"
          :severity="point.status === 1 ? 'success' : isCurrentStep(idx) ? 'warn' : 'secondary'" class="point-number"
          rounded />
      </div>

      <div v-if="(idx + 1) % 4 !== 0 && idx !== details.length - 1" class="h-line"
        :class="{ active: point.status === 1 }" />

      <div class="point-label">{{ point.cpName }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useOfflineManager } from '@/composables/useOfflineManager';
import { Badge, Tag } from '@/plugins/primevue.components';

const store = useStore();
const { pendingItems } = useOfflineManager();

interface RouteDetail {
  rdId: number | string;
  cpId: number | string;
  cpName: string;
  status: number;
  cpPriority: number;
}

const props = defineProps<{
  details: RouteDetail[];
}>();

const buildCountsFromQueue = (queue: any[]) => {
  const counts: Record<string, number> = {};
  const currentPsId = store.state.psId;

  queue.forEach((item: any) => {
    if (item.data && item.data.cpId && Number(item.data.psId) === Number(currentPsId)) {
      const cpId = String(item.data.cpId);
      counts[cpId] = (counts[cpId] || 0) + (item.data.reports?.length || 1);
    }
  });

  return counts;
};

/** Ưu tiên pendingItems (RAM) — cập nhật ngay khi addToQueue xong, kể cả gửi nền */
const offlineCounts = computed(() => {
  // Track psId để đếm lại khi đổi ca
  void store.state.psId;
  return buildCountsFromQueue(pendingItems.value || []);
});

const getOfflineCount = (cpId: number | string): number => {
  return offlineCounts.value[String(cpId)] || 0;
};

const isCurrentStep = (index: number): boolean => {
  if (!props.details) return false;
  const firstIncomplete = props.details.findIndex((p: RouteDetail) => p.status !== 1);
  return index === firstIncomplete;
};
</script>

<style scoped>
.points-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  height: stretch;
  padding-top: 7px;
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
  border-radius: 14px;
  padding: 2px;
  border: 2px solid #b8e6ea;
  transition: border-color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  box-shadow: 0 3px 10px rgba(56, 189, 248, 0.12);
}

.point-node.done {
  border-color: #4ade80;
  background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%);
  box-shadow: 0 3px 10px rgba(74, 222, 128, 0.22);
}

.point-node.next-step {
  border-color: #fbbf24;
  border-style: dashed;
  background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
  animation: pulse-orange 2s infinite;
}

.point-number {
  position: absolute;
  bottom: -9px;
  right: -13px;
  min-width: 1.45rem;
  justify-content: center;
  font-size: 0.75rem !important;
  font-weight: 700 !important;
  padding: 0.15rem 0.35rem !important;
  border: 1.5px solid #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
  z-index: 2;
}

.point-number :deep(.p-tag-label) {
  line-height: 1.1;
}

.points-icon {
  font-size: 1.75rem;
  color: #7dd3fc;
}

.point-node.done .points-icon {
  color: #22c55e;
}

.point-node.next-step .points-icon {
  color: #f59e0b;
}

.check-badge {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 1.3rem !important;
  min-width: 1.3rem !important;
  height: 1.3rem !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 6px rgba(34, 197, 94, 0.35);
}

.check-badge :deep(.p-badge) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #22c55e !important;
}

.check-badge i {
  font-size: 0.68rem;
  font-weight: 700;
}

.sync-badge {
  position: absolute;
  bottom: -9px;
  left: -6px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  border: 2px solid #ffffff;
  background: linear-gradient(135deg, #ebd722 0%, #eddc45 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(233, 218, 14, 0.35);
}

.sync-icon {
  font-size: 1rem;
  line-height: 1;
}

.point-number :deep(.p-tag) {
  border: 2px solid #ffffff;
}

.point-number :deep(.p-tag-secondary) {
  background: #94a3b8 !important;
  color: #ffffff !important;
}

.point-number :deep(.p-tag-success) {
  background: #22c55e !important;
  color: #ffffff !important;
}

.point-number :deep(.p-tag-warn) {
  background: #f59e0b !important;
  color: #ffffff !important;
}

.point-label {
  margin-top: 8px;
  font-size: 0.7rem;
  color: #334155;
  font-weight: 500;
  text-align: center;
  line-height: 1.25;
}

.h-line {
  background: #cfe8eb;
  position: absolute;
  top: 25px;
  right: -33%;
  width: 50%;
  height: 2px;
  z-index: 0;
}

.h-line.active {
  background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
}

@keyframes pulse-orange {
  0% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.45);
    transform: scale(1);
  }

  70% {
    box-shadow: 0 0 0 8px rgba(251, 191, 36, 0);
    transform: scale(1.05);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
    transform: scale(1);
  }
}
</style>
