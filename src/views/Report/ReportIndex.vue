<template>
  <div class="report-page">
    <header class="route-header">
      <button type="button" class="route-back-btn" :aria-label="$t('routes.go-home')" @click="router.replace('/home')">
        <i class="pi pi-arrow-left route-back-icon" aria-hidden="true" />
        <span class="route-title">{{ $t('page.reports') }}</span>
      </button>
    </header>

    <AppPageContent class="report-content">
      <div class="report-bg" aria-hidden="true">
        <span class="report-blob report-blob-green" />
        <span class="report-blob report-blob-purple" />
      </div>

      <div class="report-body">
        <div class="no-report-container">
          <div class="no-report-content">
            <i class="pi pi-calendar report-big-icon" />

            <h3>{{ $t('reports.not-found') }}</h3>
            <p>{{ $t('reports.no-data') }}</p>

            <Button :label="$t('reports.go-home')" severity="secondary" variant="outlined" icon="pi pi-home"
              class="report-go-home-btn" size="large" @click="router.replace('/home')" />
          </div>
        </div>
      </div>
    </AppPageContent>
  </div>
</template>

<script setup lang="ts">
import router from '@/router';
import AppPageContent from '@/components/AppPageContent.vue';
import { useHardwareBackButton } from '@/composables/useHardwareBackButton';
import { Button } from '@/plugins/primevue.components';

useHardwareBackButton(10, () => {
  router.replace('/home');
});
</script>

<style scoped>
.report-page {
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

.route-back-btn:hover,
.route-back-btn:focus,
.route-back-btn:focus-visible,
.route-back-btn:active {
  background: transparent;
  outline: none;
  box-shadow: none;
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

.report-content {
  display: flex;
  flex-direction: column;
}

.report-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.report-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  -webkit-filter: blur(40px);
  opacity: 0.9;
}

.report-blob-green {
  width: 250px;
  height: 250px;
  background: #e3f7ac;
  top: 20%;
  right: -50px;
}

.report-blob-purple {
  width: 250px;
  height: 250px;
  background: #cac2e9;
  bottom: 10%;
  left: -80px;
}

.report-body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.no-report-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.no-report-content {
  max-width: 360px;
  text-align: center;
  color: #475569;
}

.no-report-content h3 {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}

.no-report-content p {
  margin: 0 0 20px;
  font-size: 0.9rem;
  line-height: 1.5;
}

.report-big-icon {
  font-size: 4rem;
  color: #cbd5e1;
  margin-bottom: 16px;
}

.report-go-home-btn {
  border-radius: 12px;
}
</style>
