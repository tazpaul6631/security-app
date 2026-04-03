<template>
    <ion-modal :is-open="isOpen" @didDismiss="$emit('close')">
        <ion-header>
            <ion-toolbar color="primary" class="text-padding">
                <ion-title>{{ $t('areas.report.issue-type') }}</ion-title>
                <ion-buttons slot="end">
                    <ion-button @click="$emit('close')">{{ $t('areas.report.close') }}</ion-button>
                </ion-buttons>
            </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
            <ion-accordion-group>
                <ion-accordion v-for="cat in apiCategories" :key="cat.rncId" :value="cat.rncName">
                    <ion-item slot="header" color="light">
                        <ion-label>{{ cat.rncName }}</ion-label>
                    </ion-item>
                    <div class="ion-padding" slot="content">
                        <ion-list>
                            <ion-item v-for="sub in cat.childs" :key="sub.rncId" button detail
                                @click="$emit('selectCategory', sub)">
                                <ion-label>{{ sub.rncName }}</ion-label>
                            </ion-item>
                        </ion-list>
                    </div>
                </ion-accordion>
            </ion-accordion-group>

            <div v-if="groupedNotes.length > 0" class="ion-margin-top">
                <ion-label color="medium">{{ $t('areas.report.selected-status') }}</ion-label>
                <ion-card v-for="(group, index) in groupedNotes" :key="group.id" class="note-group-card">
                    <ion-card-header>
                        <ion-card-title style="font-size: 15px;">{{ index + 1 }}. {{ group.priImageNote
                        }}</ion-card-title>
                        <ion-button fill="clear" color="danger" class="btn-delete-group"
                            @click="$emit('removeGroup', index)">
                            <ion-icon slot="icon-only" :icon="trash"></ion-icon>
                        </ion-button>
                    </ion-card-header>

                    <ion-card-content>
                        <ion-row>
                            <ion-col>
                                <ion-button expand="block" size="small" @click="$emit('addPhoto', index)">
                                    <ion-icon slot="start" :icon="camera"></ion-icon> {{ $t('areas.report.camera') }}
                                </ion-button>
                            </ion-col>
                            <!-- <ion-col size="6">
                                <ion-button expand="block" size="small" @click="$emit('pickPhotos', index)">
                                    <ion-icon slot="start" :icon="images"></ion-icon> {{ $t('areas.report.gallery') }}
                                </ion-button>
                            </ion-col> -->
                        </ion-row>

                        <ion-grid v-if="group.reportImages.length > 0 || group.isAddingPhoto">
                            <ion-row>
                                <ion-col size="4" v-for="(photo, pIdx) in group.reportImages" :key="pIdx">
                                    <div class="image-container">
                                        <ion-img :src="photo.preview" class="thumb-img" />
                                        <div class="delete-btn" @click="$emit('removePhoto', { gIdx: index, pIdx })">
                                            <ion-icon :icon="trash"></ion-icon>
                                        </div>
                                    </div>
                                </ion-col>

                                <ion-col size="4" v-if="group.isAddingPhoto">
                                    <div class="image-container loading-container">
                                        <ion-spinner name="crescent" color="medium"></ion-spinner>
                                    </div>
                                </ion-col>
                            </ion-row>
                        </ion-grid>
                    </ion-card-content>
                </ion-card>
            </div>
        </ion-content>
    </ion-modal>
</template>

<script setup lang="ts">
import {
    IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonList, IonCard,
    IonCardHeader, IonCardTitle, IonIcon, IonCardContent, IonRow, IonCol,
    IonGrid, IonImg, IonSpinner
} from '@ionic/vue';
import { trash, camera, images } from 'ionicons/icons';

defineProps<{
    isOpen: boolean;
    apiCategories: any[];
    groupedNotes: any[];
}>();

defineEmits([
    'close', 'selectCategory', 'removeGroup',
    'addPhoto', 'pickPhotos', 'removePhoto'
]);
</script>

<style scoped>
.text-padding {
    padding-top: 0;
    margin-top: 34px;
}

.note-group-card {
    margin-top: 12px;
    border: 1px solid #e0e0e0;
    position: relative;
}

.btn-delete-group {
    position: absolute;
    top: 0;
    right: 0;
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
}

.delete-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(255, 0, 0, 0.7);
    color: white;
    border-radius: 50%;
    padding: 4px;
    font-size: 14px;
    height: 25px;
}

.loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f0f0f0;
    border: 1px dashed #ccc;
    border-radius: 4px;
}
</style>