<template>
  <Dialog :visible="isOpen" modal :header="$t('areas.report.detail-note')" class="note-dialog"
    :style="{ width: 'min(92vw, 28rem)' }" :draggable="false" :closable="false" :close-on-escape="false"
    :dismissable-mask="false" @update:visible="onDialogVisibleChange">
    <div class="note-content">
      <label class="note-label" for="note-input">{{ $t('areas.report.content') }}</label>
      <Textarea id="note-input" v-model="localNote" rows="4" :placeholder="$t('areas.report.placeholder-input')"
        class="note-textarea" />
    </div>

    <template #footer>
      <Button :label="$t('areas.report.close')" severity="secondary" variant="outlined" @click="closeModal"
        size="large" />
      <Button :label="$t('areas.report.btn-confirm')" icon="pi pi-check" severity="success"
        :disabled="!localNote.trim()" @click="confirm" size="large" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { useHardwareBackButton } from '@/composables/useHardwareBackButton';
import { ref, watch } from 'vue';
import { Button, Dialog, Textarea } from '@/plugins/primevue.components';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits(['close', 'confirm']);

const localNote = ref('');

// Xóa trắng ô nhập mỗi khi mở lại modal
watch(() => props.isOpen, (newVal) => {
  if (newVal) localNote.value = '';
});

const closeModal = () => emit('close');
const onDialogVisibleChange = (visible: boolean) => {
  if (!visible) closeModal();
};

const confirm = () => {
  if (localNote.value.trim()) {
    emit('confirm', localNote.value.trim());
    localNote.value = '';
  }
};

// Chặn back vật lý trong lúc modal note đang mở.
useHardwareBackButton(10002, () => {
  if (props.isOpen) return;
});
</script>

<style scoped>
.note-dialog :deep(.p-dialog-header) {
  padding-bottom: 0.8rem;
}

.note-dialog :deep(.p-dialog-content) {
  padding-top: 0.6rem;
}

.note-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.note-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
}

.note-textarea {
  width: 100%;
}
</style>