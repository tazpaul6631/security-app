<template>
  <ion-page class="log-page">
    <header class="route-header">
      <button type="button" class="route-back-btn" :aria-label="$t('routes.go-home')" @click="router.replace('/home')">
        <i class="pi pi-arrow-left route-back-icon" aria-hidden="true" />
        <span class="route-title">{{ $t('page.logs') }}</span>
      </button>
    </header>

    <ion-content class="log-content ion-padding">
      <div class="log-bg" aria-hidden="true">
        <span class="log-blob log-blob-green" />
        <span class="log-blob log-blob-purple" />
      </div>

      <div class="log-body">
        <Card class="log-filter-card"
          :pt="{ body: { class: 'log-filter-card-body' }, content: { class: 'log-filter-card-content' } }">
          <template #content>
            <label for="filterDate" class="log-filter-label">{{ $t('logs.filter-date') }}</label>
            <DatePicker inputId="filterDate" v-model="filterDate" dateFormat="dd/mm/yy" showTime hourFormat="24" fluid
              showIcon iconDisplay="input" :placeholder="$t('logs.filter-date-placeholder')" />
          </template>
          <template #footer>
            <div class="log-filter-card-footer-buttons">
              <Button class="log-delete-btn" :label="$t('logs.delete-all-logs')" icon="pi pi-trash" severity="danger"
                size="large" :disabled="logs.length === 0" @click="openDeleteConfirm" />
              <Button class="log-retry-btn" :label="$t('logs.retry-sync')" icon="pi pi-sync" severity="success"
                size="large" :loading="isSyncing" :disabled="isSyncing || !isOnline || filteredLogs.length === 0"
                @click="handleRetrySync" />
            </div>
          </template>
        </Card>

        <div v-if="filteredLogs.length > 0" class="log-list">
          <Card v-for="item in filteredLogs" :key="item.localId" class="log-item-card"
            :pt="{ body: { class: 'log-item-card-body' }, content: { class: 'log-item-card-content' } }">
            <template #content>
              <div class="log-item-row">
                <span class="log-item-time">
                  {{ item.psHourFrom }}h — {{ item.psDay }}/{{ item.psMonth }}/{{ item.psYear }}
                </span>
                <Tag :value="statusLabel(item.status)" :severity="statusSeverity(item.status)" />
              </div>
              <p class="log-item-title">{{ item.routeName }}</p>
              <p class="log-item-meta">
                {{ item.areaName }} · {{ item.reportName }}
                · {{ item.completedCount }}/{{ item.pointCount }}
              </p>
              <p v-if="item.lastSyncError" class="log-item-error">{{ item.lastSyncError }}</p>
              <p class="log-item-sub">
                {{ $t('logs.attempts') }}: {{ item.syncAttempts || 0 }}
                <template v-if="item.lastSyncAt"> · {{ formatTime(item.lastSyncAt) }}</template>
              </p>
            </template>
          </Card>
        </div>

        <div v-else class="no-log-container">
          <div class="no-log-content">
            <i class="pi pi-calendar log-big-icon" />
            <h3>{{ $t('logs.not-found') }}</h3>
            <Button :label="$t('logs.go-home')" severity="secondary" variant="outlined" icon="pi pi-home"
              class="log-go-home-btn" size="large" @click="router.replace('/home')" />
          </div>
        </div>
      </div>
    </ion-content>

    <Dialog v-model:visible="isDeleteConfirmOpen" modal :header="$t('logs.delete-confirm-title')"
      class="log-delete-dialog" :style="{ width: 'min(92vw, 24rem)' }" :draggable="false" :closable="false">
      <p class="log-delete-dialog-message">{{ $t('logs.delete-confirm-msg') }}</p>
      <template #footer>
        <Button :label="$t('layout.cancel')" severity="secondary" variant="outlined" size="large" :disabled="isDeleting"
          @click="isDeleteConfirmOpen = false" />
        <Button :label="$t('logs.delete-all-logs')" icon="pi pi-trash" severity="danger" size="large"
          :loading="isDeleting" @click="confirmDeleteAllLogs" />
      </template>
    </Dialog>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { IonPage, IonContent, useBackButton, onIonViewWillEnter } from '@ionic/vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import router from '@/router';
import { Button, Card, DatePicker, Dialog, Tag } from '@/plugins/primevue.components';
import {
  loadPatrolShiftLogs,
  syncPatrolShiftLogs,
  PATROL_SHIFT_LOGS_KEY,
  type PatrolShiftLogRecord,
  type PatrolShiftLogStatus,
} from '@/services/patrolShiftLog.service';
import storageService from '@/services/storage.service';

const { t } = useI18n();
const store = useStore();
const filterDate = ref<Date | null>(null);
const logs = ref<PatrolShiftLogRecord[]>([]);
const isSyncing = ref(false);
const isDeleteConfirmOpen = ref(false);
const isDeleting = ref(false);
const isOnline = computed(() => store.state.isOnline);

const filteredLogs = computed(() => {
  if (!filterDate.value) return logs.value;
  const d = filterDate.value;
  const hour = d.getHours();
  const minute = d.getMinutes();

  return logs.value.filter((item) => {
    const sameDay =
      Number(item.psDay) === d.getDate() &&
      Number(item.psMonth) === d.getMonth() + 1 &&
      Number(item.psYear) === d.getFullYear();
    if (!sameDay) return false;

    // Có chọn giờ (khác 00:00) → lọc theo psHourFrom
    if (hour === 0 && minute === 0) return true;
    return Number(item.psHourFrom) === hour;
  });
});

const statusLabel = (status: PatrolShiftLogStatus) => {
  const map: Record<PatrolShiftLogStatus, string> = {
    draft: t('logs.status-draft'),
    ready: t('logs.status-ready'),
    failed: t('logs.status-failed'),
    invalid: t('logs.status-invalid'),
  };
  return map[status] || status;
};

const statusSeverity = (status: PatrolShiftLogStatus) => {
  if (status === 'ready') return 'warn';
  if (status === 'failed' || status === 'invalid') return 'danger';
  return 'secondary';
};

const formatTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const refreshLogs = async () => {
  logs.value = await loadPatrolShiftLogs();
};

const handleRetrySync = async () => {
  if (!isOnline.value || isSyncing.value) return;
  isSyncing.value = true;
  try {
    await syncPatrolShiftLogs();
    await refreshLogs();
  } finally {
    isSyncing.value = false;
  }
};

const openDeleteConfirm = () => {
  if (logs.value.length === 0) return;
  isDeleteConfirmOpen.value = true;
};

const confirmDeleteAllLogs = async () => {
  isDeleting.value = true;
  try {
    await storageService.remove(PATROL_SHIFT_LOGS_KEY);
    await refreshLogs();
    isDeleteConfirmOpen.value = false;
  } finally {
    isDeleting.value = false;
  }
};

useBackButton(10, () => {
  router.replace('/home');
});

onMounted(() => {
  void refreshLogs();
});

onIonViewWillEnter(() => {
  void refreshLogs();
});
</script>

<style scoped>
.log-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.route-header {
  min-height: 48px;
  padding: 4px 8px 4px 4px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.route-back-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 8px;
  min-height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 10px;
  text-align: left;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
  font: inherit;
}

.route-back-icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: #334155;
}

.route-title {
  flex: 1;
  min-width: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.log-content {
  flex: 1;
  min-height: 0;
  --background: #d1e5e6;
}

.log-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px;
  background: #ffffff;
  border-radius: 10px;
  min-height: calc(100% - 8px);
}

.log-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.log-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  -webkit-filter: blur(40px);
  opacity: 0.9;
}

.log-blob-green {
  width: 250px;
  height: 250px;
  background: #e3f7ac;
  top: 20%;
  right: -50px;
}

.log-blob-purple {
  width: 250px;
  height: 250px;
  background: #cac2e9;
  bottom: 10%;
  left: -80px;
}

.log-filter-card {
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

:deep(.log-filter-card-body),
:deep(.log-filter-card-content) {
  padding: 5px;
}

.log-filter-label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
}

.log-retry-btn {
  width: 100%;
  border-radius: 10px;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.log-item-card {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: none;
}

.log-filter-card-footer-buttons {
  display: flex;
  gap: 10px;
}

.log-delete-btn {
  width: 100%;
  border-radius: 10px;
}

.log-retry-btn {
  width: 100%;
  border-radius: 10px;
}

.log-item-card :deep(.log-item-card-body),
.log-item-card :deep(.log-item-card-content) {
  padding: 12px;
}

.log-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.log-item-time {
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
}

.log-item-title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
}

.log-item-meta,
.log-item-sub {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
  line-height: 1.4;
}

.log-item-error {
  margin: 6px 0 0;
  font-size: 0.8rem;
  color: #b91c1c;
}

.no-log-container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 200px;
}

.no-log-content {
  text-align: center;
}

.no-log-content h3 {
  margin: 0 0 16px;
  color: #64748b;
  font-size: 1rem;
  font-weight: 600;
}

.log-big-icon {
  font-size: 4rem;
  color: #cbd5e1;
  margin-bottom: 16px;
}

.log-go-home-btn {
  border-radius: 12px;
}

.log-delete-dialog-message {
  margin: 0;
  color: #334155;
  font-size: 0.95rem;
  line-height: 1.5;
}
</style>
