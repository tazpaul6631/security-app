<template>
  <ion-page>
    <ion-header>
      <ion-toolbar class="none-padding">
        <ion-buttons slot="start">
          <ion-button @click="handleGoBack">
            <ion-icon slot="icon-only" :icon="arrowBackOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>CheckPoint Create</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card class="inspection-grid-card" v-if="currentRoute && currentActiveRoute">
        <ion-card-header>
          <ion-card-title>{{ currentRoute?.routeName }}</ion-card-title>
          <ion-card-subtitle>
            Mã: {{ currentActiveRoute.routeCode }} | Giờ trực: {{ currentActiveRoute.psHourFrom }}h
            <br />
            <span class="timer-display" :class="timerColorClass" v-if="currentActiveRoute.planSecond !== undefined">
              <ion-icon class="icon-clock" :icon="timeOutline"></ion-icon> Thời gian: {{ formattedTime }}
            </span>
          </ion-card-subtitle>
        </ion-card-header>

        <ion-card-content>
          <card-route-points :details="currentActiveRoute.routeDetails" />
        </ion-card-content>
      </ion-card>

      <div v-else-if="isReady" class="ion-padding ion-text-center no-route-container">
        <ion-icon :icon="calendarOutline" style="font-size: 64px; color: #ccc;"></ion-icon>
        <p>Không tìm thấy thông tin lộ trình phù hợp.</p>
        <ion-button fill="clear" @click="router.replace('/home')">Quay lại trang chủ</ion-button>
      </div>

      <div v-if="isReady">
        <ion-card>
          <ion-grid>
            <ion-row>
              <ion-col size="7">
                <ion-card-header>
                  <ion-card-title>
                    {{ dataScanQr?.areaCode }} - {{ dataScanQr?.areaName }}
                  </ion-card-title>
                  <ion-card-subtitle>
                    {{ dataScanQr?.cpCode }} <br>{{ dataScanQr?.cpName }}
                  </ion-card-subtitle>
                </ion-card-header>
              </ion-col>
              <ion-col size="5">
                <ion-card v-if="listImages.length > 0">
                  <ion-img class="full-screen-qr" alt="picbas64" :src="listImages[0].url" />
                </ion-card>
              </ion-col>
            </ion-row>
            <ion-row>
              <ion-col>
                <ion-card-content>
                  {{ dataScanQr?.cpDescription }}
                </ion-card-content>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card>

        <ion-card>
          <ion-card-content>
            <ion-item>
              <ion-checkbox v-model="formData.prHasProblem" @click="handleChecked">
                Chọn nếu có vấn đề
              </ion-checkbox>
            </ion-item>

            <div v-if="formData.prHasProblem">
              <ion-item>
                <ion-card-header class="pad-0">
                  <ion-label>Chọn nội dung tuần tra</ion-label>
                  <ion-button fill="outline" @click="openCategoryModal = true">
                    Tình trạng ({{ groupedNotes.length }})
                  </ion-button>
                </ion-card-header>

                <ion-modal :is-open="openCategoryModal" @didDismiss="openCategoryModal = false">
                  <ion-header>
                    <ion-toolbar class="toolbar-modal">
                      <ion-title>CHỌN HẠNG MỤC</ion-title>
                      <ion-buttons slot="end">
                        <ion-button @click="openCategoryModal = false">Đóng</ion-button>
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
                              @click="selectSubCategory(sub)">
                              <ion-label>
                                <h2>{{ sub.rncName }}</h2>
                                <p>Bấm để chọn tình trạng chi tiết</p>
                              </ion-label>
                            </ion-item>
                          </ion-list>
                        </div>
                      </ion-accordion>
                    </ion-accordion-group>

                    <div class="ion-padding-top" v-if="groupedNotes.length > 0">
                      <ion-label color="medium" class="ion-margin-bottom" style="display: block;">
                        <p>Danh sách đã chọn (Kèm ảnh):</p>
                      </ion-label>

                      <ion-card v-for="(group, index) in groupedNotes" :key="group.id" class="note-group-card">
                        <ion-card-header class="note-card-header">
                          <ion-card-title style="font-size: 16px; font-weight: bold; color: var(--ion-color-primary);">
                            {{ group.prGroup }}. {{ group.priImageNote }}
                          </ion-card-title>
                          <ion-card-subtitle>
                            Đã thêm: {{ group.reportImages.length }} ảnh
                          </ion-card-subtitle>

                          <ion-button fill="clear" color="danger" class="btn-delete-group" @click="removeGroup(index)">
                            <ion-icon slot="icon-only" :icon="trash"></ion-icon>
                          </ion-button>
                        </ion-card-header>

                        <ion-card-content>
                          <ion-row class="ion-margin-bottom">
                            <ion-col size="6">
                              <ion-button expand="block" size="small" @click="addGroupPhoto(index)">
                                <ion-icon slot="start" :icon="camera"></ion-icon> Chụp
                              </ion-button>
                            </ion-col>
                            <ion-col size="6">
                              <ion-button expand="block" size="small" @click="pickGroupImages(index)">
                                <ion-icon slot="start" :icon="images"></ion-icon> Chọn
                              </ion-button>
                            </ion-col>
                          </ion-row>

                          <ion-grid v-if="group.reportImages.length > 0" class="pad-0">
                            <ion-row>
                              <ion-col size="4" v-for="(photo, photoIdx) in group.reportImages" :key="photoIdx">
                                <div class="image-container">
                                  <ion-img :src="photo.preview" class="thumb-img"></ion-img>
                                  <div class="delete-btn" @click.stop="removeGroupPhoto(index, photoIdx)">
                                    <ion-icon :icon="trash"></ion-icon>
                                  </div>
                                </div>
                              </ion-col>
                            </ion-row>
                          </ion-grid>
                        </ion-card-content>
                      </ion-card>
                    </div>

                  </ion-content>
                </ion-modal>

                <ion-modal :is-open="openDetailModal" @didDismiss="openDetailModal = false" initial-breakpoint="0.7">
                  <ion-header>
                    <ion-toolbar>
                      <ion-title>{{ selectedSubCategory?.rncName || 'CHI TIẾT' }}</ion-title>
                    </ion-toolbar>
                  </ion-header>
                  <ion-content class="ion-padding">
                    <ion-list>
                      <ion-item>
                        <ion-select label="Lỗi phát hiện" label-placement="floating" :multiple="true"
                          v-model="selectedValues" @ionChange="handleDetailChange($event)"
                          @ionDismiss="handleSelectDismiss" placeholder="Chọn các lỗi...">

                          <ion-select-option v-for="issue in currentIssues" :key="issue.rncId" :value="issue.rncName">
                            {{ issue.rncName }}
                          </ion-select-option>

                          <ion-select-option value="note">Ghi chú khác...</ion-select-option>
                        </ion-select>
                      </ion-item>
                    </ion-list>
                  </ion-content>
                </ion-modal>

                <ion-modal :is-open="openNoteModal" @didDismiss="openNoteModal = false" initial-breakpoint="0.5">
                  <ion-content class="ion-padding">
                    <ion-textarea label="Nhập ghi chú" label-placement="floating" fill="outline" v-model="tempNoteInput"
                      :rows="4"></ion-textarea>
                    <ion-button expand="block" class="ion-margin-top" @click="confirmNote">Xác nhận</ion-button>
                  </ion-content>
                </ion-modal>
              </ion-item>
            </div>

            <ion-button expand="block" color="success" class="ion-margin-top" @click="handleSubmit">
              <ion-icon slot="start" :icon="sendOutline"></ion-icon>
              Gửi dữ liệu
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>

      <div v-else class="ion-text-center ion-padding">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Đang đồng bộ dữ liệu...</p>
      </div>

      <div v-if="pendingItems.length > 0" class="ion-margin-top">
        <ion-list-header>
          <ion-label>Đang chờ đồng bộ ({{ pendingItems?.length }})</ion-label>
          <ion-button @click="syncData" :disabled="isSyncing">
            <ion-spinner v-if="isSyncing" name="dots"></ion-spinner>
            <span v-else>Thử lại ngay</span>
          </ion-button>
        </ion-list-header>

        <ion-list lines="full">
          <ion-item-sliding v-for="item in displayItems" :key="item.id">
            <ion-item>
              <ion-thumbnail slot="start" class="pending-thumb">
                <img v-if="item.thumb" :src="item.thumb" />
                <div v-else class="no-image-placeholder">
                  <ion-icon :icon="cloudOfflineOutline" color="warning"></ion-icon>
                </div>
              </ion-thumbnail>

              <ion-label>
                <h2 class="checkpoint-name">{{ getCheckpointName(item.data?.cpId) }}</h2>
                <p class="status-info">
                  <ion-badge color="warning" mode="ios">Chờ đồng bộ</ion-badge>
                  <span class="image-count">
                    <ion-icon :icon="images"></ion-icon> {{ item.imageFiles?.length || 0 }} ảnh
                  </span>
                </p>
                <p class="time-stamp">{{ formatDate(item.id) }}</p>
              </ion-label>
            </ion-item>

            <ion-item-options side="end">
              <ion-item-option color="danger" @click="deleteItem(item.id)">
                <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
              </ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonTextarea,
  IonCheckbox, IonButton, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle,
  IonCardContent, IonGrid, IonRow, IonCol, IonImg, IonLabel, IonItemSliding,
  IonItemOptions, IonItemOption, IonListHeader, loadingController, onIonViewWillEnter,
  IonSpinner, toastController, IonBadge, IonThumbnail, IonButtons,
  IonSelect, IonModal, IonSelectOption, IonAccordion, IonAccordionGroup,
  alertController
} from '@ionic/vue';
import { sendOutline, camera, images, trash, arrowBackOutline, calendarOutline, cloudOfflineOutline, trashOutline, timeOutline } from 'ionicons/icons'; // Thêm timeOutline
import { Camera, CameraResultType, CameraDirection, CameraSource } from '@capacitor/camera';
import { useStore } from 'vuex';
import { useOfflineManager } from '@/composables/useOfflineManager';
import storage from '@/services/storage.service';
import { ImageService } from '@/services/image.service';
import router from '@/router';
import storageService from '@/services/storage.service';
import { App } from '@capacitor/app';
import CardRoutePoints from '@/components/CardRoutePoints.vue';
import { useRouteTimer } from '@/composables/useRouteTimer';

const { formattedTime, timerColorClass, startTimer, clearTimer } = useRouteTimer();

const store = useStore();
const isReady = ref(false);

///////////////////////////////////
interface RouteDetail {
  rdId: number | string;
  cpId: number | string;
  cpName: string;
  status: number;
}

interface Route {
  routeId: number;
  routeName: string;
  routeCode: string;
  psHourFrom: number;
  psHourTo: number;
  planSecond?: number;
  routeDetails: RouteDetail[];
  areaId: number;
  roleId: number;
  psId: number;
}

interface Photo {
  fileName: string;
  rawBase64: string;
  preview: string;
  [key: string]: any;
}

interface GroupedNote {
  id: string;
  prGroup: number;
  priImageNote: string;
  reportImages: Photo[];
  type: 'label' | 'note';
  rncId?: string;
}

interface QueueItem {
  id: number | string;
  data?: any;
  note?: string;
  userId?: string;
  imageFiles?: string[];
  thumb?: string | null;
  isMock?: boolean;
}

interface ReportNode {
  rncId: number | string;
  rncName: string;
  childs?: ReportNode[];
  [key: string]: any;
}
///////////////////////////////////

const currentHour = ref(new Date().getHours());

const currentActiveRoute = computed<Route | null>(() => {
  const routes = store.state.dataListRoute;
  const userData = store.state.dataUser;
  if (!routes || !routes.length || !userData) return null;

  const uRole = Number(userData.userRoleId);
  const uArea = Number(userData.userAreaId);
  const hNow = currentHour.value;

  const foundRoute = routes.find((r: any) => {
    // Để giữ nguyên mạch Logic bên RouteIndex, nếu route đã được bắt đầu quét
    // thì vẫn giữ lại trên màn hình
    const isStarted = r.routeDetails && r.routeDetails.some((p: any) => p.status === 1);
    const isFinished = r.routeDetails && r.routeDetails.every((p: any) => p.status === 1);

    if (isStarted && !isFinished && Number(r.areaId) === uArea && Number(r.roleId) === uRole) {
      return true;
    }

    const areaMatch = Number(r.areaId) === uArea;
    const roleMatch = Number(r.roleId) === uRole;
    const hourMatch = hNow >= Number(r.psHourFrom) && hNow <= Number(r.psHourTo);
    return areaMatch && roleMatch && hourMatch;
  });

  if (foundRoute) {
    store.commit('SET_PSID', foundRoute.psId);
    return { ...foundRoute };
  }
  return null;
});

// ==========================================
// THÊM LOGIC ĐẾM NGƯỢC THỜI GIAN (TIMER)
// ==========================================

// Khởi tạo và chạy Timer
watch(() => currentActiveRoute.value, async (newRoute) => {
  // Chỉ bắt đầu chạy giờ khi người dùng đã có lộ trình hợp lệ
  // và (tuỳ chọn của bạn) có thể check thêm xem đã quét điểm nào chưa nếu muốn
  if (newRoute && newRoute.routeId && newRoute.planSecond) {
    await startTimer(newRoute.routeId, newRoute.planSecond);
  }
}, { immediate: true, deep: true });
// ==========================================


const currentRouteId = computed(() => store.state.routeId);

const currentRoute = computed<Route | null>(() => {
  const routes = store.state.dataListRoute || [];
  const selectedId = store.state.routeId;
  if (!selectedId) return null;
  return routes.find((r: any) => r.routeId == selectedId) || null;
});

const getCheckpointName = (cpId: string) => {
  if (!cpId || !currentRoute.value?.routeDetails) return 'Không xác định';
  const checkpoint = currentRoute.value.routeDetails.find(
    (cp: any) => String(cp.cpId) === String(cpId)
  );
  return checkpoint ? checkpoint.cpName : 'Checkpoint không tồn tại';
};

const dataScanQr = computed(() => {
  const rawData = store.state.dataScanQr;
  if (!rawData) return null;
  if (rawData.cpName) return rawData;
  if (rawData.data && rawData.data.cpName) return rawData.data;
  if (rawData.data && rawData.data.data && rawData.data.data.cpName) return rawData.data.data;
  if (Array.isArray(rawData) && rawData.length > 0) return rawData[0];
  if (rawData.data && Array.isArray(rawData.data) && rawData.data.length > 0) return rawData.data[0];
  return rawData;
});

const listImages = computed(() => {
  const currentData = dataScanQr.value;
  if (currentData && currentData.cpQr) {
    return [{ url: `data:image/png;base64,${currentData.cpQr}` }];
  }
  return [];
});

const showToast = async (message: string, color: string = 'success') => {
  const toast = await toastController.create({ message, duration: 5000, color, position: 'top' });
  await toast.present();
};

const formData = reactive({
  prHasProblem: false,
  createdAt: '',
  prNote: '',
  cpId: '',
  createdBy: '',
  scanAt: '',
});

const handleChecked = () => {
  if (!formData.prHasProblem) {
    groupedNotes.value = [];
    allSelectedMap.value = {};
    tempNoteList.value = [];
    selectedValues.value = [];
  }
}

const { sendData, pendingItems, loadPendingItems, syncData, isSyncing } = useOfflineManager();
const displayItems = ref<QueueItem[]>([]);

const groupedNotes = ref<GroupedNote[]>([]);
const apiCategories = ref<ReportNode[]>([]);
const selectedSubCategory = ref<ReportNode | null>(null);

const openCategoryModal = ref(false);
const openDetailModal = ref(false);
const openNoteModal = ref(false);

const selectedValues = ref<string[]>([]);
const allSelectedMap = ref<Record<string, string[]>>({});
const tempNoteInput = ref('');
const tempNoteList = ref<string[]>([]);

const currentIssues = computed(() => selectedSubCategory.value?.childs || []);

const generateId = () => Math.random().toString(36).substr(2, 9);

const updatePrGroups = () => {
  groupedNotes.value.forEach((group, index) => {
    group.prGroup = index + 1;
  });
};

const convertBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

const formatDate = (timestamp: number | string): string => {
  return new Date(timestamp).toLocaleTimeString();
};

const addGroupPhoto = async (groupIndex: number): Promise<void> => {
  try {
    const image = await Camera.getPhoto({
      quality: 60, width: 1024, height: 1024, allowEditing: false,
      resultType: CameraResultType.Uri, direction: CameraDirection.Rear, source: CameraSource.Camera
    });

    if (image.webPath) {
      groupedNotes.value[groupIndex].reportImages.push({ fileName: image.format, rawBase64: '', preview: image.webPath });
    }
  } catch (error) {
    console.log('User cancelled or error:', error);
  }
};

const pickGroupImages = async (groupIndex: number): Promise<void> => {
  try {
    const result = await Camera.pickImages({ quality: 80, limit: 10 });
    const loading = await loadingController.create({ message: 'Đang xử lý ảnh...', duration: 5000 });
    await loading.present();

    const processedPhotos: Photo[] = await Promise.all(result.photos.map(async (photo) => {
      const response = await fetch(photo.webPath as string);
      const blob = await response.blob();
      const fullBase64 = await convertBlobToBase64(blob);
      const rawBase64 = fullBase64.split(',')[1];
      const rawName = fullBase64.split('/')[1].split(';')[0];
      return { fileName: rawName, rawBase64: rawBase64, preview: fullBase64 };
    }));

    groupedNotes.value[groupIndex].reportImages.push(...processedPhotos);
    await loading.dismiss();
  } catch (error) {
    console.error('Lỗi khi chọn ảnh:', error);
  }
};

const removeGroupPhoto = (groupIndex: number, photoIndex: number) => {
  groupedNotes.value[groupIndex].reportImages.splice(photoIndex, 1);
};

const selectSubCategory = (sub: ReportNode) => {
  selectedSubCategory.value = sub;
  selectedValues.value = [];
  openDetailModal.value = true;
};

const handleDetailChange = (event: any) => {
  const values = event.detail.value;
  const subId = selectedSubCategory.value?.rncId;

  if (subId && values && values.length > 0) {
    values.forEach((val: string) => {
      if (val === 'note') return;
      const isExist = groupedNotes.value.some(
        g => g.type === 'label' && g.rncId === String(subId) && g.priImageNote === val
      );
      if (!isExist) {
        groupedNotes.value.push({
          id: generateId(),
          prGroup: groupedNotes.value.length + 1,
          priImageNote: val,
          reportImages: [],
          type: 'label',
          rncId: String(subId)
        });
      }
    });

    updatePrGroups();
    syncToMainForm();
  }

  if (values.includes('note')) {
    openNoteModal.value = true;
  }
};

const handleSelectDismiss = () => {
  setTimeout(() => {
    if (!openNoteModal.value) {
      openDetailModal.value = false;
    }
    selectedValues.value = [];
  }, 100);
};

const confirmNote = () => {
  if (tempNoteInput.value.trim()) {
    const noteText = tempNoteInput.value.trim();
    tempNoteList.value.push(noteText);

    groupedNotes.value.push({
      id: generateId(),
      prGroup: groupedNotes.value.length + 1,
      priImageNote: noteText,
      reportImages: [],
      type: 'note'
    });

    updatePrGroups();
    tempNoteInput.value = '';
  }
  openNoteModal.value = false;
  openDetailModal.value = false;
  syncToMainForm();
};

const removeGroup = (index: number) => {
  const group = groupedNotes.value[index];

  if (group.type === 'label') {
    const subId = group.rncId;
    if (subId && allSelectedMap.value[subId]) {
      allSelectedMap.value[subId] = allSelectedMap.value[subId].filter(v => v !== group.priImageNote);

      if (selectedSubCategory.value?.rncId == subId) {
        selectedValues.value = [...allSelectedMap.value[subId]];
      }

      if (allSelectedMap.value[subId].length === 0) {
        delete allSelectedMap.value[subId];
      }
    }
  } else if (group.type === 'note') {
    const noteIdx = tempNoteList.value.indexOf(group.priImageNote);
    if (noteIdx !== -1) tempNoteList.value.splice(noteIdx, 1);

    if (tempNoteList.value.length === 0) {
      selectedValues.value = selectedValues.value.filter(v => v !== 'note');
    }
  }

  groupedNotes.value.splice(index, 1);
  updatePrGroups();
  syncToMainForm();
};

const syncToMainForm = () => {
  const allTexts = groupedNotes.value.map(g => g.priImageNote);
  formData.prNote = allTexts.join(', ');
};

const handleSubmit = async (): Promise<void> => {
  const now = new Date();
  const currentTimeString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
    .toISOString()
    .slice(0, 19);

  if (!dataScanQr.value?.cpId) {
    await showToast('Lỗi: Không tìm thấy dữ liệu Checkpoint', 'danger');
    return;
  }

  const loading = await loadingController.create({ message: 'Đang lưu dữ liệu...' });
  await loading.present();

  try {
    const noteGroupsPayload = await Promise.all(groupedNotes.value.map(async (group) => {
      const mappedImages = await Promise.all(group.reportImages.map(async (item) => {
        let base64Data = item.rawBase64;
        if (!base64Data && item.preview.startsWith('http')) {
          const response = await fetch(item.preview);
          const blob = await response.blob();
          const fullBase64 = await convertBlobToBase64(blob);
          base64Data = fullBase64.split(',')[1];
        }
        return { priImage: base64Data, priImageType: item.fileName };
      }));

      return {
        prGroup: group.prGroup,
        priImageNote: group.priImageNote,
        reportImages: mappedImages
      };
    }));

    const base64ImagesOnly: string[] = [];
    noteGroupsPayload.forEach(ng => {
      ng.reportImages.forEach(img => base64ImagesOnly.push(img.priImage));
    });

    const currentCpId = dataScanQr.value.cpId;
    const routeId = store.state.routeId;
    const currentDetail = currentRoute.value?.routeDetails.find(
      (d: any) => String(d.cpId) === String(currentCpId)
    );
    const rdId = currentDetail?.rdId || '';
    const rawUser = store.state.dataUser;
    const actualUser = rawUser?.data ? rawUser.data : rawUser;
    const userId = actualUser?.userId || '';
    const currentTime_scanQr = await storageService.get('currentTime_scanqr');
    const psId = store.state.psId;

    const formSubmitData = {
      psId: psId,
      routeId: routeId,
      rdId: rdId,
      createdAt: currentTimeString,
      prHasProblem: formData.prHasProblem,
      prNote: formData.prNote,
      cpId: currentCpId,
      createdBy: userId,
      scanAt: currentTime_scanQr,
      noteGroups: formData.prHasProblem ? noteGroupsPayload : [],
    };

    console.log("PAYLOAD GỬI ĐI:", JSON.stringify(formSubmitData, null, 2));

    await sendData(groupedNotes.value[0]?.reportImages[0]?.preview, formSubmitData, base64ImagesOnly);

    const areaCode = currentActiveRoute.value?.routeCode;

    if (areaCode && psId) {
      store.commit('MARK_ROUTE_OFFLINE_DONE', { areaCode, psId });
    }

    store.commit('UPDATE_POINT_STATUS', {
      routeId: routeId,
      cpId: currentCpId,
      status: 1
    });

    const updatedRoutes = [...store.state.dataListRoute];
    const routeIndex = updatedRoutes.findIndex(r => r.routeId == currentRouteId.value);

    if (routeIndex !== -1) {
      const details = updatedRoutes[routeIndex].routeDetails;
      const cpIndex = details.findIndex((cp: any) => String(cp.cpId) === String(dataScanQr.value.cpId));

      if (cpIndex !== -1) {
        details[cpIndex].status = 1;
        const allDone = details.every((p: any) => p.status === 1);

        if (allDone) {
          await showToast('Chúc mừng! Bạn đã hoàn thành toàn bộ lộ trình.', 'success');
          await clearTimer(routeId);
          store.commit('RESET_SPECIFIC_ROUTE', routeId);
          store.commit('SET_DATASCANQR', null);
          store.commit('SET_ROUTE_ID', null);

          await storageService.remove('current_route_id');
          await storageService.remove('data_scanqr');

          await loading.dismiss();
          router.replace({ path: '/home' });
          return;
        } else {
          store.commit('SET_DATA_LIST_ROUTE', updatedRoutes);
          await storageService.set('list_route', updatedRoutes);

          await loading.dismiss();
          await showToast(`Đã xong điểm ${details[cpIndex].cpName}. Hãy di chuyển đến điểm tiếp theo!`, 'primary');
          router.replace({ path: '/route' });
        }
      }
    }

    formData.prNote = '';
    formData.prHasProblem = false;
    groupedNotes.value = [];
    await storageService.remove('currentTime_scanqr');
    await loadPendingItemsWithImages();

  } catch (error) {
    await loading.dismiss();
    console.error("Gửi dữ liệu thất bại:", error);
    await showToast('Có lỗi xảy ra khi lưu dữ liệu', 'danger');
  }
};

const handleGoBack = async () => {
  const details = currentRoute.value?.routeDetails || [];
  if (details.length === 0) {
    router.replace('/route');
    return;
  }
  const isFinished = details.every(p => p.status === 1);
  if (isFinished) {
    router.replace('/route');
  } else {
    const alert = await alertController.create({
      header: 'Cảnh báo',
      message: 'Bạn phải hoàn thành toàn bộ lộ trình trước khi quay lại!',
      buttons: ['Đã hiểu']
    });
    await alert.present();
    return;
  }
};

const deleteItem = async (id: number | string): Promise<void> => {
  const currentQueue: QueueItem[] = await storage.get('offline_api_queue') || [];
  const itemToDelete = currentQueue.find(i => i.id === id);

  if (itemToDelete) {
    try {
      if (itemToDelete.imageFiles) {
        for (const fileName of itemToDelete.imageFiles) {
          await ImageService.deleteImage(fileName);
        }
      }
    } catch (e) { console.error("Lỗi xóa file:", e); }

    const updatedQueue = currentQueue.filter(i => i.id !== id);
    await storage.set('offline_api_queue', updatedQueue);
    await loadPendingItemsWithImages();
    store.commit('REMOVE_OFFLINE_REPORT', id);
  }
};

const loadPendingItemsWithImages = async (): Promise<void> => {
  await loadPendingItems();
  const itemsWithUrls = await Promise.all(pendingItems.value.map(async (item: QueueItem) => {
    let thumb = null;
    if (item.imageFiles && item.imageFiles.length > 0) {
      thumb = await ImageService.getDisplayUrl(item.imageFiles[0]);
    }
    return { ...item, thumb };
  }));
  displayItems.value = [...itemsWithUrls];
};

onIonViewWillEnter(() => {
  formData.prNote = '';
  formData.prHasProblem = false;
  groupedNotes.value = [];
  allSelectedMap.value = {};
  tempNoteList.value = [];
  selectedValues.value = [];
});

onMounted(async () => {
  if (!store.state.isHydrated) {
    await store.dispatch('initApp');
  }
  await loadPendingItemsWithImages();

  const categoryData = store.state.dataReportNoteCategory;
  if (categoryData) {
    apiCategories.value = Array.isArray(categoryData) ? categoryData : (categoryData.data || []);
  }

  isReady.value = true;
  App.addListener('backButton', () => {
    handleGoBack();
  });
});
</script>

<style scoped>
.pad-0 {
  padding: 0;
}

/* CSS cho Timer */
.timer-display {
  display: flex;
  margin-top: 5px;
  font-size: 0.9rem;
  color: #666;
  transition: color 0.3s ease;
}

.icon-clock {
  padding-right: 5px;
}

.text-success {
  color: var(--ion-color-success, #2dd36f);
  font-weight: bold;
}

.text-danger {
  color: var(--ion-color-danger, #eb445a);
  font-weight: bold;
  animation: pulse-red 1s infinite;
}

@keyframes pulse-red {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }

  100% {
    opacity: 1;
  }
}

/* CSS Mới cho Card Ghi chú */
.note-group-card {
  margin: 10px 0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--ion-color-light-shade);
}

.note-card-header {
  position: relative;
  padding-right: 50px;
}

.btn-delete-group {
  position: absolute;
  top: 10px;
  right: 5px;
  margin: 0;
}

ion-list-header {
  --background: #f4f5f8;
  border-radius: 8px;
}

.image-container {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  aspect-ratio: 1 / 1;
  background: #f0f0f0;
  margin-bottom: 8px;
}

.thumb-img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
  border-radius: 8px;
}

.delete-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(255, 0, 0, 0.8);
  color: white;
  border-radius: 50%;
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
}

.pending-thumb {
  --size: 56px;
  --border-radius: 8px;
  margin-right: 12px;
}

.pending-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff4e5;
  border-radius: 8px;
}

.checkpoint-name {
  font-weight: bold;
  font-size: 1rem;
  color: #333;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.image-count {
  font-size: 0.85rem;
  color: #666;
  display: flex;
  align-items: center;
}

.time-stamp {
  font-size: 0.8rem;
  color: #999;
}

.inspection-grid-card {
  margin: 10px;
}
</style>