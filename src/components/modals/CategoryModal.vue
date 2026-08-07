<template>
  <Dialog :visible="isOpen" modal :header="$t('areas.report.issue-type')" class="category-dialog"
    :style="{ width: 'min(94vw, 44rem)' }" :draggable="false" :closable="false" :close-on-escape="false"
    :dismissable-mask="false" :pt="{
      root: { class: 'category-dialog-root' },
      content: { class: 'category-dialog-content' },
    }">
    <div class="category-content" :class="{ 'has-selected': groupedNotes.length > 0 }">
      <div class="category-list">
        <button v-for="cat in apiCategories" :key="'flat-' + cat.rncId" type="button" class="category-row"
          :class="{ checked: isChecked(cat) }" size="large" @click="handleRowClick(cat)">
          <Checkbox :model-value="isChecked(cat)" binary :pt="{ root: { class: 'category-check' } }" />
          <span class="category-name">
            {{ cat.rncName }} <span v-if="cat.isNote">...</span>
          </span>
        </button>
      </div>

      <div v-if="groupedNotes.length > 0" class="selected-block">
        <div class="selected-title-row">
          <span class="selected-title">{{ $t('areas.report.selected-status') }}</span>
          <Tag :value="photoProgressLabel" :severity="photoProgressSeverity" class="photo-progress-tag" rounded />
        </div>

        <div class="selected-groups-scroll">
          <Card v-for="(group, index) in groupedNotes" :key="group.id" class="note-group-card">
            <template #title>
              <div class="note-group-header">
                <span class="note-group-title">{{ index + 1 }}. {{ group.priImageNote }}</span>
                <Button icon="pi pi-trash" severity="danger" class="btn-delete-group" size="large"
                  @click="$emit('removeGroup', index)" />
              </div>
            </template>

            <template #content>
              <Button :label="$t('areas.report.camera')" icon="pi pi-camera" class="btn-camera" fluid size="large"
                @click="$emit('addPhoto', index)" />

              <div v-if="group.reportImages.length > 0 || group.isAddingPhoto" class="photo-grid">
                <div v-for="(photo, pIdx) in group.reportImages" :key="pIdx" class="image-container">
                  <img :src="photo.preview" class="thumb-img" alt="" />
                  <button type="button" class="delete-btn" size="large"
                    @click="$emit('removePhoto', { gIdx: index, pIdx })">
                    <i class="pi pi-trash" aria-hidden="true" />
                  </button>
                </div>

                <div v-if="group.isAddingPhoto" class="image-container loading-container">
                  <ProgressSpinner stroke-width="6" />
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </div>

    <template #footer>
      <Button :label="$t('areas.report.close')" severity="secondary" variant="outlined" @click="handleClose"
        size="large" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { useBackButton } from '@ionic/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCameraHandler } from '@/composables/useCameraHandler';
import { Button, Card, Checkbox, Dialog, ProgressSpinner, Tag } from '@/plugins/primevue.components';

const { showToast } = useCameraHandler();
const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  apiCategories: any[];
  groupedNotes: any[];
}>();

const emit = defineEmits([
  'close', 'selectCategory', 'removeGroup',
  'addPhoto', 'pickPhotos', 'removePhoto', 'selectDirectNote',
  'toggleCategory'
]);

const isChecked = (cat: any) => {
  return props.groupedNotes.some((g: any) => g.rncId === String(cat.rncId));
};

const groupsWithPhotoCount = computed(() =>
  props.groupedNotes.filter((group) => (group.reportImages?.length ?? 0) > 0).length
);

const photoProgressLabel = computed(
  () => `${groupsWithPhotoCount.value}/${props.groupedNotes.length}`
);

const photoProgressSeverity = computed(() => {
  const total = props.groupedNotes.length;
  const done = groupsWithPhotoCount.value;
  if (done === 0) return 'info';
  if (done < total) return 'info';
  return 'success';
});

const handleRowClick = (cat: any) => {
  const currentChecked = isChecked(cat);
  emit('toggleCategory', { cat, isChecked: !currentChecked });
};

const checkCanDismiss = async () => {
  const isMissingImage = props.groupedNotes.some((group: any) => group.reportImages.length === 0);

  if (isMissingImage) {
    await showToast(t('areas.report.img-status'), 'warning');
    return false;
  }
  return true;
};

const handleClose = async () => {
  const canClose = await checkCanDismiss();
  if (canClose) emit('close');
};

// Khi modal mở, chặn back vật lý để tránh thoát flow đang nhập liệu.
useBackButton(10001, () => {
  if (props.isOpen) return;
});
</script>

<style scoped>
.category-dialog :deep(.p-dialog),
.category-dialog :deep(.category-dialog-root) {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 2rem);
  overflow: hidden;
}

.category-dialog :deep(.p-dialog-header) {
  flex-shrink: 0;
  padding-bottom: 0.5rem;
}

.category-dialog :deep(.p-dialog-footer) {
  flex-shrink: 0;
  border-top: 1px solid #e2e8f0;
  padding-top: 0.8rem;
}

.category-dialog-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden !important;
  display: flex;
  flex-direction: column;
  padding-right: 2px;
}

.category-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.category-content.has-selected {
  height: calc(100dvh - 14rem);
  max-height: calc(100dvh - 14rem);
}

.category-list {
  flex: 0 0 auto;
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  padding: 6px;
}

.category-row {
  width: 100%;
  border: none;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.2s ease;
}

.category-row:active {
  background: #f1f5f9;
}

.category-row:last-child {
  border-bottom: none;
}

.category-check {
  pointer-events: none;
}

.category-name {
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
}

.selected-block {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  padding: 12px;
}

.selected-title-row {
  flex: 0 0 auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.selected-groups-scroll {
  flex: 1 1 0;
  min-height: 0;
  height: 0;
  overflow-y: scroll;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
}

.selected-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.photo-progress-tag {
  flex-shrink: 0;
  font-weight: 700;
}

.photo-progress-tag :deep(.p-tag-label) {
  min-width: 2.5rem;
  text-align: center;
}

.note-group-card {
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.note-group-card :deep(.p-card-body) {
  padding: 10px;
}

.note-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.note-group-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.35;
}

.btn-delete-group {
  flex-shrink: 0;
}

.image-container {
  position: relative;
  aspect-ratio: 1;
  border-radius: 4px;
  overflow: hidden;
  background: #eee;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 1.6rem;
  height: 1.6rem;
  border: none;
  background: rgba(220, 38, 38, 0.85);
  color: #ffffff;
  border-radius: 50%;
  padding: 0;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8fafc;
  border: 1px dashed #cbd5e1;
}

.photo-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.btn-camera {
  min-height: 2.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 10px;
}

@media (max-width: 576px) {
  .category-content.has-selected {
    height: calc(100dvh - 15rem);
    max-height: calc(100dvh - 15rem);
  }
}
</style>