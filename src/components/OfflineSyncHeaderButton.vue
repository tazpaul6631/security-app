<template>
  <button type="button" class="offline-sync-header-btn" :aria-label="$t('areas.report.pending-sync')"
    @click="emit('click')">
    <i class="pi pi-cloud-upload offline-sync-header-icon" aria-hidden="true" />
    <span v-if="count > 0" class="offline-sync-badge">{{ count > 99 ? '99+' : count }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  count: number;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<style scoped>
.offline-sync-header-btn {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  margin: 0;
  padding: 0;
  border: 1px solid #e7b343;
  border-radius: 10px;
  background: #f3cc78;
  color: #ffffff;
  cursor: pointer;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.offline-sync-header-btn:hover,
.offline-sync-header-btn:focus,
.offline-sync-header-btn:focus-visible,
.offline-sync-header-btn:active {
  outline: none;
}

.offline-sync-header-icon {
  font-size: 1.25rem;
}

.offline-sync-badge {
  position: absolute;
  top: -7px;
  right: -6px;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 4px;
  border-radius: 999px;
  background: #f59e0b;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.125rem;
  text-align: center;
}
</style>
