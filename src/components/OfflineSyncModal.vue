<template>
  <Dialog v-model:visible="isOpen" modal :header="dialogHeader" class="offline-sync-dialog"
    :style="{ width: 'min(92vw, 24rem)' }" :draggable="false" :dismissable-mask="true" :closable="false"
    :close-on-escape="false">
    <OfflineSyncList v-if="displayItems.length > 0" :displayItems="displayItems" :paginatedItems="paginatedItems"
      :loadedCount="loadedCount" :getCheckpointName="getCheckpointName" @loadMore="loadMoreOfflineItems" />

    <p v-else class="offline-sync-empty">{{ $t('areas.report.offline-sync-empty') }}</p>

    <template #footer>
      <Button :label="$t('areas.report.close')" severity="secondary" variant="outlined" size="large"
        @click="isOpen = false" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, Dialog } from '@/plugins/primevue.components';
import OfflineSyncList from '@/components/OfflineSyncList.vue';
import { useOfflineSyncDisplay } from '@/composables/useOfflineSyncDisplay';

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
  paginatedItems,
  loadedCount,
  loadMoreOfflineItems,
  refreshDisplayItems,
  getCheckpointName,
} = useOfflineSyncDisplay((cpId) => props.getCheckpointName(cpId));

const dialogHeader = computed(() =>
  `${t('areas.report.pending-sync')} (${displayItems.value.length})`
);

watch(
  () => props.visible,
  async (open) => {
    if (open) {
      await refreshDisplayItems();
    }
  }
);
</script>

<style scoped>
.offline-sync-dialog :deep(.p-dialog-content) {
  padding-top: 0;
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
