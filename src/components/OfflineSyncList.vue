<template>
  <Card v-if="groupedItems.length > 0" class="offline-sync-card">
    <template #content>
      <div class="offline-sync-list">
        <section v-for="group in groupedItems" :key="group.key" class="offline-group">
          <h3 class="group-title">
            {{ formatGroupLabel(group) }}
          </h3>

          <div v-for="item in group.items" :key="item.id" class="offline-sync-item">
            <div class="item-thumb" :class="{ 'item-thumb--icon': !item.thumb }">
              <img v-if="item.thumb" :src="item.thumb" class="item-thumb-img" alt="" />
              <i v-else class="pi pi-cloud offline-cloud-icon" aria-hidden="true" />
            </div>

            <div class="item-body">
              <h3 class="item-name">{{ getCheckpointName(item.data?.cpId) }}</h3>
              <p class="item-meta">
                <Tag :value="$t('areas.report.offline')" severity="warn" class="offline-tag" />
                <span class="item-time">{{ formatDate(item.data?.createdAt) }}</span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { Card, Tag } from '@/plugins/primevue.components';
import type { OfflineQueueGroup } from '@/composables/useOfflineSyncDisplay';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';

defineProps<{
  groupedItems: OfflineQueueGroup[];
  getCheckpointName: Function;
}>();

defineEmits(['delete']);

const { t } = useI18n();
const store = useStore();

const formatDate = (ts: any) => new Date(ts).toLocaleTimeString();

const formatGroupLabel = (group: OfflineQueueGroup) => {
  const first = group.items[0]?.data || {};
  const routes = store.state.dataListRoute || [];
  const matchedRoute = routes.find((r: any) =>
    Number(r?.psId) === Number(group.psId) &&
    Number(r?.routeId) === Number(first.routeId)
  ) || routes.find((r: any) => Number(r?.psId) === Number(group.psId));

  const psHourFrom = matchedRoute?.psHourFrom ?? first.psHourFrom;
  const psDay = matchedRoute?.psDay ?? first.psDay;
  const psMonth = matchedRoute?.psMonth ?? first.psMonth;
  const psYear = matchedRoute?.psYear ?? first.psYear;

  const hasShiftDate =
    psHourFrom !== null && psHourFrom !== undefined &&
    psDay !== null && psDay !== undefined &&
    psMonth !== null && psMonth !== undefined &&
    psYear !== null && psYear !== undefined;

  if (hasShiftDate) {
    const datePart = `${psDay}/${psMonth}/${psYear}`;
    return `${t('routes.shift')} ${psHourFrom}h - ${datePart} (${group.items.length})`;
  }

  return `${t('routes.shift')} #${group.psId ?? '-'} (${group.items.length})`;
};
</script>

<style scoped>
.offline-sync-card {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  background: #ffffff;
  position: relative;
  z-index: 1;
}

.offline-sync-card :deep(.p-card-body) {
  padding: 0 14px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.offline-sync-card :deep(.p-card-title) {
  margin: 0;
  padding: 14px 0 0 0;
}

.offline-sync-title {
  font-size: 1rem;
  font-weight: 700;
  color: #0f766e;
}

.offline-sync-list {
  display: flex;
  flex-direction: column;
  max-height: min(32dvh, 22rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding-right: 2px;
}

.offline-group {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.group-title {
  margin: 0;
  padding: 10px 0 0;
  font-size: 0.9rem;
  font-weight: bold;
  color: #eb9617;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.offline-sync-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.offline-sync-item:last-child {
  border-bottom: none;
}

.item-thumb {
  flex-shrink: 0;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 10px;
  overflow: hidden;
  background: #f1f5f9;
}

.item-thumb--icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff7ed;
}

.item-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.offline-cloud-icon {
  font-size: 1.5rem;
  color: #f59e0b;
}

.item-body {
  flex: 1;
  min-width: 0;
}

.item-name {
  margin: 0 0 6px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.35;
}

.item-meta {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.offline-tag {
  flex-shrink: 0;
}

.item-time {
  font-size: 0.85rem;
  color: #64748b;
}
</style>
