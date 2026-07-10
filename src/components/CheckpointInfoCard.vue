<template>
  <Card class="checkpoint-card">
    <template #content>
      <div class="checkpoint-header">
        <h2 class="checkpoint-area">{{ dataScanQr.areaName }}</h2>
        <span v-if="formattedTime" class="timer-display" :class="timerColorClass">
          <i class="pi pi-clock icon-clock" aria-hidden="true" />
          {{ $t('areas.report.countdown') }} {{ formattedTime }}
        </span>
      </div>

      <p class="checkpoint-name">{{ dataScanQr.cpCode }} - {{ dataScanQr.cpName }}</p>

      <p v-if="currentActiveRoute" class="checkpoint-subtitle">
        {{ $t('areas.report.code') }} {{ currentActiveRoute.routeCode }} | {{ $t('areas.report.shift') }}
        {{ currentActiveRoute.psHourFrom }}h -
        {{ currentActiveRoute.psDay }}/{{ currentActiveRoute.psMonth }}/{{ currentActiveRoute.psYear }}
      </p>

      <p v-if="dataScanQr.cpDescription" class="checkpoint-description">
        {{ dataScanQr.cpDescription }}
      </p>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { Card } from '@/plugins/primevue.components';

// Nhận dữ liệu từ Component Cha truyền vào
defineProps<{
  dataScanQr: any;
  currentActiveRoute: any;
  formattedTime: string | null;
  timerColorClass: string;
}>();
</script>

<style scoped>
.checkpoint-card {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  background: #ffffff;
}

.checkpoint-card :deep(.p-card-body) {
  padding: 14px;
}

.checkpoint-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.checkpoint-area {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.3;
  color: #0f172a;
}

.checkpoint-name {
  margin: 6px 0 0;
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.45;
}

.checkpoint-subtitle {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: #64748b;
  line-height: 1.45;
}

.checkpoint-description {
  margin: 6px 0 0;
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.5;
}

.timer-display {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #64748b;
  transition: color 0.3s ease;
}

.icon-clock {
  margin-right: 4px;
  font-size: 0.95rem;
}

.text-success {
  color: #16a34a;
}

.text-danger {
  color: #dc2626;
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
</style>