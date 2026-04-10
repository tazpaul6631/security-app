<template>
  <ion-modal class="custom-bottom-sheet" :is-open="isOpen" @didDismiss="$emit('close')" :initial-breakpoint="0.7"
    :breakpoints="[0, 0.7, 1]">
    <ion-content class="ion-padding">
      <ion-list>
        <ion-list-header>
          <ion-label style="font-size: 18px; font-weight: bold;"><strong>{{ selectedSubCategory?.rncName
              }}</strong></ion-label>
        </ion-list-header>

        <ion-item class="issue-item" v-for="issue in currentIssues" :key="issue.rncId" button
          @click="handleItemClick(issue)">

          <ion-checkbox v-if="!issue.isNote" slot="start" style="pointer-events: none; margin-left: 13px;"
            :checked="selectedValues.some(v => String(v.rncId) === String(issue.rncId))" aria-hidden="true">
          </ion-checkbox>

          <ion-icon v-else slot="start" :icon="addCircleOutline"
            style="margin-right: 14px; margin-left: 10px;"></ion-icon>

          <ion-label style="font-weight: bold;">
            {{ issue.rncName }} {{ issue.isNote ? '...' : '' }}
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-button expand="block" class="ion-margin-top btn-confirm" @click="$emit('confirm')">{{
        $t('areas.report.btn-confirm') }}</ion-button>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { IonModal, IonContent, IonList, IonListHeader, IonLabel, IonItem, IonCheckbox, IonButton, IonIcon } from '@ionic/vue';
import { addCircleOutline } from 'ionicons/icons';

defineProps<{
  isOpen: boolean;
  selectedSubCategory: any;
  currentIssues: any[];
  selectedValues: any[];
}>();

const emit = defineEmits(['close', 'toggleIssue', 'confirm', 'addNoteIssue']);

// Tách riêng hành vi click
const handleItemClick = (issue: any) => {
  if (issue.isNote) {
    emit('addNoteIssue', issue); // Gọi thẳng modal nhập Text (có thể gọi nhiều lần)
  } else {
    emit('toggleIssue', issue); // Bật/tắt checkbox
  }
};
</script>

<style scoped>
ion-modal.custom-bottom-sheet::part(content) {
  box-shadow: 0 -8px 20px rgba(0, 0, 0, 0.15);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
}

ion-modal.custom-bottom-sheet::part(handle) {
  background: #ccc;
  width: 40px;
}

ion-list-header {
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 10px;
}

ion-item {
  cursor: pointer;
}

ion-label {
  user-select: none;
}

.btn-confirm {
  height: 45px;
  font-size: 16px;
  font-weight: bold;
}
</style>