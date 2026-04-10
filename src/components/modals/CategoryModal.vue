<template>
  <ion-modal :is-open="isOpen" :can-dismiss="checkCanDismiss" @didDismiss="$emit('close')">
    <ion-header>
      <ion-toolbar color="primary" class="text-padding">
        <ion-title>{{ $t('areas.report.issue-type') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button class="btn-close" @click="handleClose">{{ $t('areas.report.close') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-accordion-group>
        <template v-for="cat in apiCategories" :key="cat.rncId">
          <ion-accordion v-if="cat.childs && cat.childs.length > 0" :value="cat.rncName">
            <ion-item slot="header" color="light">
              <ion-label style="font-weight: bold;">{{ cat.rncName }}</ion-label>
            </ion-item>
            <div class="ion-padding" slot="content">
              <ion-list>
                <ion-item v-for="sub in cat.childs" :key="sub.rncId" button detail
                  @click="$emit('selectCategory', sub)">
                  <ion-label style="font-weight: bold;">{{ sub.rncName }}</ion-label>
                </ion-item>
              </ion-list>
            </div>
          </ion-accordion>
        </template>
      </ion-accordion-group>

      <ion-list class="custom-direct-list" v-if="apiCategories.some(c => !c.childs || c.childs.length === 0)">
        <ion-item v-for="cat in apiCategories.filter(c => !c.childs || c.childs.length === 0)"
          :key="'direct-' + cat.rncId" button color="light" lines="full" class="direct-note-item"
          @click="$emit('selectDirectNote', cat)">
          <ion-label style="font-weight: bold;">
            {{ cat.rncName }} {{ cat.isNote ? '...' : '' }}
          </ion-label>
        </ion-item>
      </ion-list>

      <div v-if="groupedNotes.length > 0" class="ion-margin-top">
        <ion-card>
          <ion-card-header>
            <ion-card-title style="font-size: 18px;">{{ $t('areas.report.selected-status')
            }}</ion-card-title>
          </ion-card-header>
          <ion-card-content class="ion-no-padding">
            <ion-card v-for="(group, index) in groupedNotes" :key="group.id" class="note-group-card">
              <ion-card-header>
                <ion-card-title style="font-size: 16px;">{{ index + 1 }}. {{ group.priImageNote
                }}</ion-card-title>
                <ion-button fill="clear" color="danger" class="btn-delete-group" @click="$emit('removeGroup', index)">
                  <ion-icon slot="icon-only" :icon="trash"></ion-icon>
                </ion-button>
              </ion-card-header>

              <ion-card-content class="ion-no-padding">
                <ion-row>
                  <ion-col>
                    <ion-button class="btn-camera" expand="block" @click="$emit('addPhoto', index)">
                      <ion-icon slot="start" :icon="camera"></ion-icon> {{
                        $t('areas.report.camera') }}
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
import { useI18n } from 'vue-i18n';
import { useCameraHandler } from '@/composables/useCameraHandler';

const { showToast } = useCameraHandler();
const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  apiCategories: any[];
  groupedNotes: any[];
}>();

const emit = defineEmits([
  'close', 'selectCategory', 'removeGroup',
  'addPhoto', 'pickPhotos', 'removePhoto', 'selectDirectNote'
]);

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

  if (canClose) {
    emit('close');
  }
};
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

.btn-camera {
  height: 40px;
  font-size: 17px;
  font-weight: bold;
}

.btn-close {
  font-size: 17px;
  font-weight: bold;
}


.custom-direct-list {
  margin-top: 0;
  padding-top: 0;
  border-top: 1px solid var(--ion-border-color, rgba(0, 0, 0, 0.2));
}

.direct-note-item {
  --min-height: 48px;
}

.direct-note-item::part(detail-icon) {
  display: none;
}
</style>