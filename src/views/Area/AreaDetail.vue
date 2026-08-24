<template>
  <div class="area-detail-page">
    <header class="route-header">
      <button type="button" class="route-back-btn" :aria-label="$t('page.areas.index')"
        @click="router.replace('/area')">
        <i class="pi pi-arrow-left route-back-icon" aria-hidden="true" />
        <span class="route-title">{{ $t('page.areas.detail') }}</span>
      </button>
    </header>

    <AppPageContent class="area-detail-content" locked>
      <div class="detail-bg" aria-hidden="true">
        <span class="detail-blob detail-blob-green" />
        <span class="detail-blob detail-blob-purple" />
      </div>

      <div v-if="!getPrIdData" class="empty-wrap">
        <div class="empty-state">
          <i class="pi pi-calendar empty-icon" />
          <h3>{{ $t('areas.detail.emty-data') }}</h3>
          <Button :label="$t('areas.detail.go-home')" severity="secondary" variant="outlined" icon="pi pi-home"
            class="empty-home-btn" size="large" @click="goHome" />
        </div>
      </div>

      <div v-else class="detail-body">
        <Card class="detail-card"
          :pt="{ body: { class: 'detail-card-body' }, content: { class: 'detail-card-content' } }">
          <template #title>
            <div class="detail-title-row">
              <span class="detail-area-name">{{ $t('areas.detail.area') }} {{ getPrIdData.areaName }}</span>
              <span class="status-badge"
                :class="getPrIdData.prHasProblem && getPrIdData.prStatus === 0 ? 'problem1' : getPrIdData.prHasProblem && getPrIdData.prStatus === 1 ? 'problem2' : 'normal'">
                {{ getPrIdData.prHasProblem && getPrIdData.prStatus === 0 ? $t('areas.detail.stt-pending') :
                  getPrIdData.prHasProblem &&
                    getPrIdData.prStatus === 1 ? $t('areas.detail.stt-processing') : getPrIdData.prStatus === 2 ?
                    $t('areas.detail.stt-completed') : $t('areas.detail.stt-no-issue') }}
              </span>
            </div>
          </template>
          <template #subtitle>
            <span class="detail-subtitle">
              {{ $t('areas.detail.position') }}
              <span class="detail-value">{{ getPrIdData.cpName }}</span>
            </span>
          </template>
          <template #content>
            <div class="detail-info">
              <div class="detail-block">
                <p class="detail-label">
                  {{ $t('areas.detail.estimated-time') }}
                  <span class="detail-value">
                    {{ getPrIdData.planHours ? `${getPrIdData.planHours}h` : '' }}
                    {{ getPrIdData.planMinutes ? `${getPrIdData.planMinutes}m` : '' }}
                    {{ getPrIdData.planSeconds ? `${getPrIdData.planSeconds}s` : '' }}
                  </span>
                </p>
                <p class="detail-label" :class="{ 'is-problem': getPrIdData.timeProblem }">
                  {{ $t('areas.detail.actual-time') }}
                  <span class="detail-value">
                    {{ getPrIdData.realityHours ? `${getPrIdData.realityHours}h` : '' }}
                    {{ getPrIdData.realityMinutes ? `${getPrIdData.realityMinutes}m` : '' }}
                    {{ getPrIdData.realitySeconds ? `${getPrIdData.realitySeconds}s` : '' }}
                  </span>
                </p>
              </div>

              <div class="detail-block">
                <p class="detail-label">
                  {{ $t('areas.detail.user-report') }}
                  <span class="detail-value">{{ getPrIdData.reportName }}</span>
                </p>
                <p class="detail-label" :class="{ 'is-problem': getPrIdData.shiftProblem }">
                  {{ $t('areas.detail.date-report') }}
                  <span class="detail-value">{{ formatDate(getPrIdData.reportAt) }}</span>
                </p>
              </div>

              <div v-if="getPrIdData.prHasProblem" class="detail-block">
                <p class="detail-label">
                  {{ $t('areas.detail.user-update') }}
                  <span class="detail-value">{{ getPrIdData.updatedName }}</span>
                </p>
                <p class="detail-label">
                  {{ $t('areas.detail.date-update') }}
                  <span class="detail-value">{{ formatDate(getPrIdData.updatedAt) }}</span>
                </p>
              </div>

              <div v-if="getPrIdData.cpDescription" class="detail-block">
                <p class="detail-label">
                  {{ $t('areas.detail.cp-desc') }}
                  <span class="description-text">{{ getPrIdData.cpDescription }}</span>
                </p>
              </div>

              <div class="detail-block">
                <p class="detail-label">{{ $t('areas.detail.general-notes') }}
                  <span class="note-content">
                    {{ getProblemData(getPrIdData.prNote).name ? $t(getProblemData(getPrIdData.prNote).name) :
                      getPrIdData.prNote }}
                  </span>
                </p>
              </div>
            </div>

            <div v-if="listGroups.length > 0" class="groups-container">
              <p class="group-section-title">{{ $t('areas.detail.pic-rp') }}</p>

              <div v-for="(group, index) in listGroups" :key="index" class="group-box">
                <div class="group-header">
                  <i class="pi pi-image group-icon" />
                  <span class="group-note-text">{{ group.note }}</span>
                </div>

                <div class="image-grid">
                  <button v-for="(img, imgIndex) in group.images" :key="imgIndex" type="button"
                    class="thumbnail-wrapper" @click="openModal(img)">
                    <img :src="img.url" class="thumb-img" alt="" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <Dialog v-model:visible="isModalOpen" modal :show-header="false" class="image-viewer-dialog"
        :style="{ width: 'min(96vw, 40rem)' }" :draggable="false" :dismissable-mask="true" :pt="{
          mask: { class: 'image-viewer-mask' },
          root: { class: 'image-viewer-root' },
          content: { class: 'image-viewer-content' },
        }" @hide="closeModal">
        <div class="modal-wrapper">
          <swiper v-if="isModalOpen" :initial-slide="currentSlideIndex" :centered-slides="true" :space-between="20"
            :auto-height="true" class="viewer-swiper">
            <swiper-slide v-for="(img, idx) in allImagesFlat" :key="idx" class="swiper-slide-content">
              <div class="slide-inner">
                <img :src="img.url" class="slide-img" alt="" />
                <p class="image-caption">{{ img.note }}</p>
              </div>
            </swiper-slide>
          </swiper>
        </div>
      </Dialog>
    </AppPageContent>
  </div>
</template>


<script setup lang="ts">
import router from '@/router';
import AppPageContent from '@/components/AppPageContent.vue';
import { useHardwareBackButton } from '@/composables/useHardwareBackButton';
import { Button, Card, Dialog } from '@/plugins/primevue.components';
import { computed, onActivated, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import { Swiper, SwiperSlide } from 'swiper/vue';
import 'swiper/css';

const store = useStore();
const { t } = useI18n();

// State cho Modal ảnh
const isModalOpen = ref(false);
const currentSlideIndex = ref(0);

// Chuyển listGroups thành ref để xử lý logic async
const listGroups = ref<any[]>([]);

const getPrIdData = computed(() => {
  const dataStoreRP = store.state.currentCheckpoint;
  if (!dataStoreRP) return null;

  let actualData = dataStoreRP?.data?.data || dataStoreRP?.data || dataStoreRP;

  if (Array.isArray(actualData)) {
    if (actualData.length > 0) {
      actualData = actualData[0];
    } else {
      return null;
    }
  }

  // Không hỗ trợ xem báo cáo offline mock trên màn detail
  if (actualData?.isOfflineMock) return null;

  return actualData;
});

/**
 * Xử lý danh sách ảnh từ API (URL / Base64) — chỉ online
 */
watch(() => getPrIdData.value, async (data) => {
  if (data && data.noteGroups && Array.isArray(data.noteGroups)) {
    const processedGroups = await Promise.all(data.noteGroups.map(async (group: any) => {
      const processedImages = await Promise.all((group.reportImages || []).map(async (img: any) => {
        let imageUrl = '';

        if (img.priUrl) {
          imageUrl = img.priUrl;
        } else if (img.priImage) {
          const base64String = img.priImage || '';
          const mimeType = img.priImageType || 'jpeg';
          imageUrl = base64String.startsWith('data:image')
            ? base64String
            : `data:image/${mimeType};base64,${base64String}`;
        }

        return { url: imageUrl, note: group.priImageNote };
      }));

      return {
        note: group.priImageNote || t('areas.detail.no-title'),
        images: processedImages.filter((img: { url: string }) => img.url)
      };
    }));

    listGroups.value = processedGroups.filter((g: any) => g.images.length > 0);
  } else {
    listGroups.value = [];
  }
}, { immediate: true });

onActivated(() => {
  if (!store.state.isOnline || !getPrIdData.value) {
    // Không có mạng hoặc không có data API → để empty state / về Areas
    if (!store.state.isOnline) {
      router.replace('/area');
    }
  }
});

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const allImagesFlat = computed(() => {
  let flatArray: { url: string; note?: string }[] = [];
  listGroups.value.forEach((group: any) => {
    flatArray = [...flatArray, ...group.images];
  });
  return flatArray;
});

const openModal = (img: { url: string; note?: string }) => {
  const index = allImagesFlat.value.findIndex(x => x.url === img.url);
  currentSlideIndex.value = index !== -1 ? index : 0;
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const goHome = () => {
  router.push('/home');
};

const listProblems = ref([
  { problem: 'Không có vấn đề phát sinh', name: 'areas.detail.issue-none' },
  { problem: 'Có vấn đề phát sinh', name: 'areas.detail.issue-found' }
]);

const getProblemData = (text: string) => {
  const problem = listProblems.value.find(r => r.problem === text);
  return problem ? problem : { name: '' };
};

useHardwareBackButton(10, () => {
  if (isModalOpen.value) {
    closeModal();
    return;
  }
  router.replace('/area');
});
</script>

<style scoped>
.area-detail-page {
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

.area-detail-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.detail-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  -webkit-filter: blur(40px);
  opacity: 0.9;
}

.detail-blob-green {
  width: 250px;
  height: 250px;
  background: #e3f7ac;
  top: 20%;
  right: -50px;
}

.detail-blob-purple {
  width: 250px;
  height: 250px;
  background: #cac2e9;
  bottom: 10%;
  left: -80px;
}

.detail-body,
.empty-wrap {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
}

.detail-body {
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}

.empty-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.empty-state {
  max-width: 360px;
  text-align: center;
  color: #475569;
}

.empty-state h3 {
  margin: 0 0 16px;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}

.empty-icon {
  font-size: 4rem;
  color: #cbd5e1;
  margin-bottom: 16px;
}

.empty-home-btn {
  border-radius: 12px;
}

.detail-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 4px 20px rgba(90, 120, 125, 0.12);
  background: rgba(255, 255, 255, 0.92);
}

.detail-card :deep(.detail-card-body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.detail-card :deep(.p-card-caption) {
  flex-shrink: 0;
  padding: 16px 16px 0;
}

.detail-card :deep(.detail-card-content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.detail-card:has(.groups-container) :deep(.detail-card-content) {
  overflow: hidden;
}

.detail-info {
  flex-shrink: 0;
}

.detail-card:has(.groups-container) .detail-info {
  flex-shrink: 1;
  min-height: 0;
  max-height: 55%;
  overflow-y: auto;
}

.detail-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.detail-area-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.35;
}

.detail-subtitle {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-block {
  margin-bottom: 4px;
}

.detail-label {
  display: block !important;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-value {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #0ea5e9;
  line-height: 1.4;
  text-transform: none;
}

.detail-label.is-problem,
.detail-label.is-problem .detail-value {
  color: #dc2626;
  font-weight: 600;
}

.description-text {
  margin: 0;
  color: #0ea5e9;
  font-size: 0.9rem;
}

.note-content {
  color: #0ea5e9;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
  text-transform: none;
}

.status-badge {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.status-badge.normal {
  background: #d4fcc7;
  color: #1e4620;
}

.status-badge.problem1 {
  background: #ffdada;
  color: #7a1b1b;
}

.status-badge.problem2 {
  background: #ffb86a;
  color: #7a1b1b;
}

.groups-container {
  flex: 1;
  min-height: 0;
  padding-top: 12px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  border-top: 1px solid #e2e8f0;
}

.group-section-title {
  margin: 0 0 12px;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
}

.group-box {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
}

.group-box:last-child {
  margin-bottom: 0;
}

.group-header {
  background: #f8fafc;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.group-icon {
  font-size: 1rem;
  color: #0ea5e9;
}

.group-note-text {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: #334155;
  font-size: 0.9rem;
  word-break: break-word;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 10px;
}

.thumbnail-wrapper {
  aspect-ratio: 1 / 1;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f5f9;
  cursor: pointer;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-viewer-dialog :deep(.p-dialog),
.image-viewer-dialog :deep(.image-viewer-root) {
  width: min(96vw, 40rem);
  height: auto;
  max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1.5rem);
  margin: 0;
  background: #0f172a;
  border-radius: 16px;
  overflow: hidden;
}

.image-viewer-dialog :deep(.p-dialog-content),
.image-viewer-dialog :deep(.image-viewer-content) {
  padding: 0;
  height: auto;
  overflow: hidden;
  background: transparent;
}

.modal-wrapper {
  position: relative;
  width: 100%;
  height: auto;
  display: flex;
  flex-direction: column;
  margin-top: 24px;
}

.close-modal-btn {
  color: #ffffff !important;
}

.viewer-swiper {
  width: 100%;
  height: auto;
}

.viewer-swiper :deep(.swiper),
.viewer-swiper :deep(.swiper-wrapper),
.viewer-swiper :deep(.swiper-slide) {
  height: auto;
}

.swiper-slide-content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: auto;
}

.slide-inner {
  width: 100%;
  text-align: center;
  padding: 0 10px 0;
}

.slide-img {
  max-width: 100%;
  width: auto;
  height: auto;
  max-height: min(62dvh, calc(100dvh - 10rem));
  object-fit: contain;
  display: block;
  margin: 0 auto;
}

.image-caption {
  color: #000000;
  margin: 12px 0 0;
  font-size: 1rem;
}
</style>

<style>
.image-viewer-mask.p-dialog-mask {
  padding: 0;
  background: rgba(15, 23, 42, 0.96);
}
</style>