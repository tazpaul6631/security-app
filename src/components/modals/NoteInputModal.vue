<template>
  <ion-modal :is-open="isOpen" @didDismiss="closeModal" class="custom-center-modal">
    <ion-content class="modal-transparent-content">
      <div class="flex-center-container">
        <ion-card class="popup-card">
          <ion-card-header>
            <ion-card-title style="font-size: 18px;">{{ $t('areas.report.detail-note') }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-textarea :label="$t('areas.report.content')" label-placement="floating" fill="outline"
              v-model="localNote" :rows="4" :placeholder="$t('areas.report.placeholder-input')">
            </ion-textarea>

            <ion-button expand="block" color="success" class="ion-margin-top btn-confirm" @click="confirm">
              {{ $t('areas.report.btn-confirm') }}
            </ion-button>
            <ion-button expand="block" fill="clear" color="medium" @click="closeModal">
              {{ $t('areas.report.close') }}
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonModal, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonTextarea, IonButton } from '@ionic/vue';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits(['close', 'confirm']);

const localNote = ref('');

// Xóa trắng ô nhập mỗi khi mở lại modal
watch(() => props.isOpen, (newVal) => {
  if (newVal) localNote.value = '';
});

const closeModal = () => emit('close');

const confirm = () => {
  if (localNote.value.trim()) {
    emit('confirm', localNote.value.trim());
    localNote.value = '';
  }
};
</script>

<style scoped>
ion-modal.custom-center-modal {
  --background: transparent;
}

.modal-transparent-content {
  --background: rgba(0, 0, 0, 0.4);
}

.flex-center-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  padding: 20px;
}

.popup-card {
  width: 100%;
  max-width: 400px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  margin: 0;
}

.btn-confirm {
  --ion-color-contrast: white !important;
  font-size: 20px;
}
</style>