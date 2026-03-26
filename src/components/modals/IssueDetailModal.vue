<template>
    <ion-modal class="custom-bottom-sheet" :is-open="isOpen" @didDismiss="$emit('close')" :initial-breakpoint="0.7"
        :breakpoints="[0, 0.7, 1]">
        <ion-content class="ion-padding">
            <ion-list>
                <ion-list-header>
                    <ion-label><strong>{{ selectedSubCategory?.rncName }}</strong></ion-label>
                </ion-list-header>

                <ion-item v-for="issue in currentIssues" :key="issue.rncId" button
                    @click="$emit('toggleIssue', issue.rncName)">
                    <ion-checkbox slot="start" :checked="selectedValues.includes(issue.rncName)"
                        aria-hidden="true"></ion-checkbox>
                    <ion-label>{{ issue.rncName }}</ion-label>
                </ion-item>

                <ion-item button @click="$emit('toggleIssue', 'note')">
                    <ion-checkbox slot="start" :checked="selectedValues.includes('note')"
                        aria-hidden="true"></ion-checkbox>
                    <ion-label>{{ $t('areas.report.other-note') }}</ion-label>
                </ion-item>
            </ion-list>

            <ion-button expand="block" class="ion-margin-top" @click="$emit('confirm')">{{
                $t('areas.report.btn-confirm') }}</ion-button>
        </ion-content>
    </ion-modal>
</template>

<script setup lang="ts">
import { IonModal, IonContent, IonList, IonListHeader, IonLabel, IonItem, IonCheckbox, IonButton } from '@ionic/vue';

defineProps<{
    isOpen: boolean;
    selectedSubCategory: any;
    currentIssues: any[];
    selectedValues: string[];
}>();

defineEmits(['close', 'toggleIssue', 'confirm']);
</script>

<style scoped>
/* Copy CSS liên quan đến custom-bottom-sheet từ cha sang */
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
</style>