<template>
  <Dialog v-model:visible="isOpen" modal :header="dialogHeader" class="offline-sync-dialog"
    :style="{ width: 'min(92vw, 24rem)' }" :draggable="false" :dismissable-mask="true" :closable="false"
    :close-on-escape="false">
    <div v-if="isRefreshing && displayItems.length === 0" class="offline-sync-loading">
      <ProgressSpinner stroke-width="3" class="offline-sync-spinner" />
      <p>{{ $t('areas.report.offline-sync-loading') }}</p>
    </div>

    <OfflineSyncList v-else-if="displayItems.length > 0" :groupedItems="groupedItems"
      :getCheckpointName="getCheckpointName" />

    <p v-else class="offline-sync-empty">{{ $t('areas.report.offline-sync-empty') }}</p>

    <template #footer>
      <Button :label="$t('areas.report.close')" severity="secondary" variant="outlined" size="large"
        @click="isOpen = false" />
      <Button :label="$t('areas.report.sync')" severity="primary" variant="outlined" size="large"
        :loading="isSyncing" :disabled="!canSync" @click="handleSync" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, Dialog, ProgressSpinner } from '@/plugins/primevue.components';
import OfflineSyncList from '@/components/OfflineSyncList.vue';
import { useOfflineSyncDisplay } from '@/composables/useOfflineSyncDisplay';
import { useOfflineManager } from '@/composables/useOfflineManager';

const props = defineProps<{
  visible: boolean;
  getCheckpointName: (cpId: string) => string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const { t } = useI18n();

const isOpen = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
});

const {
  displayItems,
  groupedItems,
  isRefreshing,
  refreshDisplayItems,
  getCheckpointName,
} = useOfflineSyncDisplay((cpId) => props.getCheckpointName(cpId));

const { syncData, isSyncing } = useOfflineManager();

const canSync = computed(
  () => !isSyncing.value && displayItems.value.length > 0
);

const handleSync = async () => {
  if (!canSync.value) return;
  await syncData();
  await refreshDisplayItems();
};

const dialogHeader = computed(() =>
  `${t('areas.report.pending-sync')} (${displayItems.value.length})`
);

watch(
  () => props.visible,
  (open) => {
    if (open) {
      void refreshDisplayItems();
    }
  }
);
</script>

<style scoped>
.offline-sync-dialog :deep(.p-dialog-content) {
  padding-top: 0;
}

.offline-sync-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 8px;
  color: #64748b;
  font-size: 0.9rem;
}

.offline-sync-spinner {
  width: 2.5rem;
  height: 2.5rem;
}

.offline-sync-loading p {
  margin: 0;
}

.offline-sync-empty {
  margin: 0;
  padding: 8px 0 4px;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
