<template>
  <ion-page>
    <ion-header>
      <ion-toolbar class="none-padding">
        <ion-buttons slot="start">
          <ion-button @click="handleGoBack">
            <ion-icon slot="icon-only" :icon="arrowBackOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Báo cáo điểm quét</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="isReady && dataScanQr">
        <ion-card>
          <ion-grid>
            <ion-row>
              <ion-col>
                <ion-card-header class="pad-0">
                  <ion-card-title>{{ dataScanQr.areaName }}</ion-card-title>
                  <ion-card-subtitle>
                    <strong>{{ dataScanQr.cpCode }}</strong> - {{ dataScanQr.cpName }}
                  </ion-card-subtitle>
                </ion-card-header>
              </ion-col>
            </ion-row>
            <ion-row v-if="dataScanQr.cpDescription">
              <ion-col>
                <ion-card-content class="pad-0 ion-padding-top">
                  {{ dataScanQr.cpDescription }}
                </ion-card-content>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card>

        <ion-card>
          <ion-card-content>
            <ion-item v-if="!formData.prHasProblem" lines="none">
              <ion-checkbox v-model="formData.prNoProblem" @ionChange="handleCheckedNoProblem">
                Không Phát hiện vấn đề / Sự cố
              </ion-checkbox>
            </ion-item>

            <div v-if="formData.prNoProblem" class="ion-padding-top">
              <ion-row>
                <ion-col size="6">
                  <ion-button expand="block" size="small" @click="addNoProblemPhoto">
                    <ion-icon slot="start" :icon="camera"></ion-icon> Máy ảnh
                  </ion-button>
                </ion-col>
                <ion-col size="6">
                  <ion-button expand="block" size="small" @click="pickNoProblemImages">
                    <ion-icon slot="start" :icon="images"></ion-icon> Thư viện
                  </ion-button>
                </ion-col>
              </ion-row>

              <ion-grid v-if="noProblemImages.length > 0">
                <ion-row>
                  <ion-col size="4" v-for="(photo, pIdx) in noProblemImages" :key="pIdx">
                    <div class="image-container">
                      <ion-img :src="photo.preview" class="thumb-img" />
                      <div class="delete-btn" @click="removeNoProblemPhoto(pIdx)">
                        <ion-icon :icon="trash"></ion-icon>
                      </div>
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>

              <ion-row>
                <ion-col>
                  <ion-textarea label="Nội dung" label-placement="floating" fill="outline" v-model="formData.prNote"
                    :rows="4" placeholder="Nhập tại đây...">
                  </ion-textarea>
                </ion-col>
              </ion-row>
            </div>

            <ion-item v-if="!formData.prNoProblem" lines="none">
              <ion-checkbox v-model="formData.prHasProblem" @ionChange="handleCheckedHasProblem">
                Phát hiện vấn đề / Sự cố
              </ion-checkbox>
            </ion-item>

            <div v-if="formData.prHasProblem" class="ion-padding-top">
              <ion-row>
                <ion-col>
                  <ion-button expand="block" fill="outline" @click="openCategoryModal = true">
                    <ion-icon slot="start" :icon="images"></ion-icon>
                    Chọn tình trạng ({{ groupedNotes.length }})
                  </ion-button>
                </ion-col>
              </ion-row>
            </div>

            <ion-button expand="block" color="success" class="ion-margin-top" @mousedown.prevent="handleSubmit"
              @click="handleSubmit">
              <ion-icon slot="start" :icon="sendOutline"></ion-icon>
              GỬI BÁO CÁO
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>

      <ion-modal :is-open="openCategoryModal" @didDismiss="openCategoryModal = false">
        <ion-header class="padding-top">
          <ion-toolbar color="primary">
            <ion-title>LOẠI SỰ CỐ</ion-title>
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
                  <ion-item v-for="sub in cat.childs" :key="sub.rncId" button detail @click="selectSubCategory(sub)">
                    <ion-label>{{ sub.rncName }}</ion-label>
                  </ion-item>
                </ion-list>
              </div>
            </ion-accordion>
          </ion-accordion-group>

          <div v-if="groupedNotes.length > 0" class="ion-margin-top">
            <ion-label color="medium">Tình trạng đã chọn:</ion-label>
            <ion-card v-for="(group, index) in groupedNotes" :key="group.id" class="note-group-card">
              <ion-card-header>
                <ion-card-title style="font-size: 15px;">{{ index + 1 }}. {{ group.priImageNote }}</ion-card-title>
                <ion-button fill="clear" color="danger" class="btn-delete-group" @click="removeGroup(index)">
                  <ion-icon slot="icon-only" :icon="trash"></ion-icon>
                </ion-button>
              </ion-card-header>
              <ion-card-content>
                <ion-row>
                  <ion-col size="6">
                    <ion-button expand="block" size="small" @click="addGroupPhoto(index)">
                      <ion-icon slot="start" :icon="camera"></ion-icon> Máy ảnh
                    </ion-button>
                  </ion-col>
                  <ion-col size="6">
                    <ion-button expand="block" size="small" @click="pickGroupImages(index)">
                      <ion-icon slot="start" :icon="images"></ion-icon> Thư viện
                    </ion-button>
                  </ion-col>
                </ion-row>
                <ion-grid v-if="group.reportImages.length > 0 || group.isAddingPhoto">
                  <ion-row>
                    <ion-col size="4" v-for="(photo, pIdx) in group.reportImages" :key="pIdx">
                      <div class="image-container">
                        <ion-img :src="photo.preview" class="thumb-img" />
                        <div class="delete-btn" @click="removeGroupPhoto(index, pIdx)">
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

      <ion-modal class="custom-bottom-sheet" :is-open="openDetailModal" @didDismiss="openDetailModal = false"
        :initial-breakpoint="0.7" :breakpoints="[0, 0.7, 1]">
        <ion-content class="ion-padding">
          <ion-list>
            <ion-list-header>
              <ion-label><strong>{{ selectedSubCategory?.rncName }}</strong></ion-label>
            </ion-list-header>
            <ion-item v-for="issue in currentIssues" :key="issue.rncId" button @click="toggleIssue(issue.rncName)">
              <ion-checkbox slot="start" :checked="selectedValues.includes(issue.rncName)"
                aria-hidden="true"></ion-checkbox>
              <ion-label>{{ issue.rncName }}</ion-label>
            </ion-item>
            <ion-item button @click="toggleIssue('note')">
              <ion-checkbox slot="start" :checked="selectedValues.includes('note')" aria-hidden="true"></ion-checkbox>
              <ion-label>Khác (Nhập ghi chú)...</ion-label>
            </ion-item>
          </ion-list>
          <ion-button expand="block" class="ion-margin-top" @click="confirmDetails">XÁC NHẬN</ion-button>
        </ion-content>
      </ion-modal>

      <ion-modal :is-open="openNoteModal" @didDismiss="openNoteModal = false" class="custom-center-modal">
        <ion-content class="modal-transparent-content">
          <div class="flex-center-container">
            <ion-card class="popup-card">
              <ion-card-header>
                <ion-card-title style="font-size: 18px;">Nhập ghi chú chi tiết</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-textarea label="Nội dung" label-placement="floating" fill="outline" v-model="tempNoteInput"
                  :rows="4" placeholder="Nhập tại đây...">
                </ion-textarea>

                <ion-button expand="block" color="success" class="ion-margin-top" @click="confirmNote">
                  Xác nhận
                </ion-button>
                <ion-button expand="block" fill="clear" color="medium" @click="openNoteModal = false">
                  Đóng
                </ion-button>
              </ion-card-content>
            </ion-card>
          </div>
        </ion-content>
      </ion-modal>

      <div v-if="displayItems.length > 0" class="ion-margin-top">
        <ion-list-header>
          <ion-label color="primary">Chờ đồng bộ ({{ displayItems.length }})</ion-label>
        </ion-list-header>

        <ion-list lines="full">
          <ion-item-sliding v-for="item in paginatedItems" :key="item.id">
            <ion-item>
              <ion-thumbnail slot="start" :class="!item.thumb ? 'icon-cloud' : ''">
                <img v-if="item.thumb" :src="item.thumb" />
                <ion-icon v-else :icon="cloudOfflineOutline" color="warning" class="icon-cloud"></ion-icon>
              </ion-thumbnail>
              <ion-label>
                <h3>{{ getCheckpointName(item.data?.cpId) }}</h3>
                <p class="info-offline">
                  <ion-badge class="badge-offline" color="warning">Offline</ion-badge>
                  {{ formatDate(item.data?.createdAt) }}
                </p>
              </ion-label>
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option color="danger" @click="deleteItem(item.id)">
                <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
              </ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </ion-list>

        <ion-infinite-scroll @ionInfinite="loadMoreOfflineItems" :disabled="loadedCount >= displayItems.length">
          <ion-infinite-scroll-content loading-spinner="bubbles" loading-text="Đang tải thêm báo cáo...">
          </ion-infinite-scroll-content>
        </ion-infinite-scroll>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch, markRaw } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonTextarea,
  IonCheckbox, IonButton, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle,
  IonCardContent, IonGrid, IonRow, IonCol, IonImg, IonLabel, IonItemSliding,
  IonItemOptions, IonItemOption, IonListHeader, loadingController, onIonViewWillEnter,
  toastController, IonBadge, IonThumbnail, IonButtons, onIonViewDidLeave,
  IonModal, IonAccordion, IonAccordionGroup, IonInfiniteScroll,
  IonInfiniteScrollContent, IonSpinner,
  alertController
} from '@ionic/vue';
import {
  sendOutline, camera, images, trash, arrowBackOutline,
  cloudOfflineOutline, trashOutline
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useStore } from 'vuex';
import { useOfflineManager } from '@/composables/useOfflineManager';
import { ImageService } from '@/services/image.service';
import router from '@/router';
import storageService from '@/services/storage.service';
import { App } from '@capacitor/app';
import { useRouteTimer } from '@/composables/useRouteTimer';
import { useRoute } from 'vue-router';

// --- Global Timer Composable ---
const { startTimer, clearTimer } = useRouteTimer();

const store = useStore();
const isReady = ref(false);
const route = useRoute();

// --- Interfaces ---
interface RouteDetail { rdId: number | string; cpId: number | string; cpName: string; status: number; }
interface Route {
  routeId: number; routeName: string; routeCode: string;
  psHourFrom: number; psHourTo: number; planSecond?: number;
  routeDetails: RouteDetail[]; psId: number;
}
interface Photo { fileName: string; preview: string; }
interface GroupedNote { id: string; prGroup: number; priImageNote: string; reportImages: Photo[]; type: 'label' | 'note'; rncId?: string; isAddingPhoto?: boolean; }
interface QueueItem { id: number | string; data?: any; imageFiles?: string[]; thumb?: string | null; }
interface ReportNode { rncId: number | string; rncName: string; childs?: ReportNode[]; }

// Lấy đúng data lộ trình từ Vuex theo ID đang quét
const currentActiveRoute = computed<Route | null>(() => {
  const routes = store.state.dataListRoute || [];
  const targetRouteId = store.state.unfinishedRouteId || store.state.routeId;
  const targetPsId = store.state.psId;

  if (!targetRouteId) return null;

  if (targetPsId) {
    const exactRoute = routes.find((r: any) =>
      Number(r.routeId) === Number(targetRouteId) &&
      Number(r.psId) === Number(targetPsId)
    );
    if (exactRoute) return exactRoute;
  }

  return routes.find((r: any) => Number(r.routeId) === Number(targetRouteId)) || null;
});

// Watch để khởi chạy Timer khi vào trang hoặc reload
watch(() => currentActiveRoute.value, async (newRoute) => {
  if (newRoute && newRoute.routeId && newRoute.planSecond) {
    await storageService.set('unfinished_route_id', newRoute.routeId);
    await startTimer(newRoute.routeId, newRoute.planSecond);
  }
}, { immediate: true });

// --- Xử lý Dữ liệu QR ---
const dataScanQr = computed(() => {
  const rawData = store.state.dataScanQr;
  if (!rawData) return null;
  return rawData.data?.data || rawData.data || rawData;
});

// --- Form State ---
const formData = reactive({ prHasProblem: false, prNoProblem: false, prNote: '', cpId: '' });
const groupedNotes = ref<GroupedNote[]>([]);
const apiCategories = ref<ReportNode[]>([]);
const selectedSubCategory = ref<ReportNode | null>(null);
const selectedValues = ref<string[]>([]);
const tempNoteInput = ref('');
const isResetting = ref(false);

// Modals
const openCategoryModal = ref(false);
const openDetailModal = ref(false);
const openNoteModal = ref(false);

const currentIssues = computed(() => selectedSubCategory.value?.childs || []);

// --- Offline Manager ---
const { sendData, pendingItems, loadPendingItems } = useOfflineManager();
const displayItems = ref<QueueItem[]>([]);

// --- TỐI ƯU HIỆU NĂNG BẰNG INFINITE SCROLL ---
const itemsPerPage = 10;
const loadedCount = ref(itemsPerPage);

const paginatedItems = computed(() => {
  return displayItems.value.slice(0, loadedCount.value);
});

const loadMoreOfflineItems = (ev: any) => {
  setTimeout(() => {
    loadedCount.value += itemsPerPage;
    ev.target.complete();
    if (loadedCount.value >= displayItems.value.length) {
      ev.target.disabled = true;
    }
  }, 300);
};

watch(() => pendingItems.value, async (newPendingQueue) => {
  displayItems.value = await Promise.all(newPendingQueue.map(async (item: QueueItem) => ({
    ...item,
    thumb: item.imageFiles?.[0] ? await ImageService.getDisplayUrl(item.imageFiles[0]) : null
  })));
}, { deep: true });

// --- Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const handleCheckedHasProblem = () => {
  if (formData.prHasProblem) {
    // KHI TICK VÀO "Có lỗi": Xóa sạch dữ liệu của bên "Không lỗi" (nếu có)
    formData.prNoProblem = false;
    noProblemImages.value = [];
    formData.prNote = ''; // Reset note
  } else {
    // KHI BỎ TICK "Có lỗi": Xóa sạch danh sách sự cố đã chọn
    groupedNotes.value = [];
    selectedValues.value = [];
    formData.prNote = '';
  }
};

const selectSubCategory = (sub: ReportNode) => {
  selectedSubCategory.value = sub;
  selectedValues.value = [];
  openDetailModal.value = true;
};

const confirmNote = () => {
  if (tempNoteInput.value.trim()) {
    groupedNotes.value.push({
      id: generateId(),
      prGroup: groupedNotes.value.length + 1,
      priImageNote: tempNoteInput.value.trim(),
      reportImages: [],
      type: 'note'
    });
    tempNoteInput.value = '';
    syncToMainForm();
  }

  openNoteModal.value = false;
  openDetailModal.value = false;
};

const syncToMainForm = () => {
  formData.prNote = groupedNotes.value.map(g => g.priImageNote).join(', ');
};

const removeGroup = (idx: number) => {
  groupedNotes.value.splice(idx, 1);
  groupedNotes.value.forEach((g, i) => g.prGroup = i + 1);
  syncToMainForm();
};

// --- Camera & Photos ---
const convertBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

const addGroupPhoto = async (idx: number) => {
  if (groupedNotes.value[idx].reportImages.length >= 10) {
    await showToast('Chỉ được phép đính kèm tối đa 10 ảnh cho mỗi sự cố!', 'warning');
    return;
  }

  try {
    groupedNotes.value[idx].isAddingPhoto = true;
    const image = await Camera.getPhoto({
      quality: 60, width: 1024, resultType: CameraResultType.Uri, source: CameraSource.Camera
    });

    if (image.webPath) {
      groupedNotes.value[idx].reportImages.push({
        fileName: 'camera_img.jpg',
        preview: image.webPath
      });
    }
  } catch (e) {
    console.log("Hủy chụp ảnh hoặc có lỗi");
  } finally {
    groupedNotes.value[idx].isAddingPhoto = false;
  }
};

const pickGroupImages = async (idx: number) => {
  const currentCount = groupedNotes.value[idx].reportImages.length;
  const maxAllowed = 10;
  const slotsLeft = maxAllowed - currentCount;

  if (slotsLeft <= 0) {
    await showToast('Đã đạt giới hạn 10 ảnh cho sự cố này!', 'warning');
    return;
  }

  try {
    const result = await Camera.pickImages({ quality: 60, limit: slotsLeft });
    let photosToAdd = result.photos;

    if (photosToAdd.length > slotsLeft) {
      await showToast(`Bạn đã chọn ${photosToAdd.length} ảnh. Hệ thống sẽ chỉ lấy ${slotsLeft} ảnh đầu tiên để không vượt quá giới hạn 10 ảnh.`, 'warning');
      photosToAdd = photosToAdd.slice(0, slotsLeft);
    }

    groupedNotes.value[idx].isAddingPhoto = true;

    for (const photo of photosToAdd) {
      groupedNotes.value[idx].reportImages.push({
        fileName: 'gallery_img.jpg',
        preview: photo.webPath
      });
    }
  } catch (e) {
    console.log("Hủy chọn ảnh hoặc có lỗi xảy ra");
  } finally {
    groupedNotes.value[idx].isAddingPhoto = false;
  }
};

const removeGroupPhoto = (gIdx: number, pIdx: number) => {
  groupedNotes.value[gIdx].reportImages.splice(pIdx, 1);
};

const toggleIssue = (val: string) => {
  const index = selectedValues.value.indexOf(val);
  if (index > -1) {
    selectedValues.value.splice(index, 1);
  } else {
    selectedValues.value.push(val);
  }
  console.log('Current selected:', selectedValues.value);
};

const confirmDetails = () => {
  const subId = selectedSubCategory.value?.rncId;
  if (!subId) return;

  selectedValues.value.forEach((val) => {
    if (val === 'note') {
      openNoteModal.value = true;
    } else {
      const exist = groupedNotes.value.some(
        g => g.type === 'label' && g.rncId === String(subId) && g.priImageNote === val
      );
      if (!exist) {
        groupedNotes.value.push({
          id: generateId(),
          prGroup: groupedNotes.value.length + 1,
          priImageNote: val,
          reportImages: [],
          type: 'label',
          rncId: String(subId)
        });
      }
    }
  });

  syncToMainForm();
  if (!selectedValues.value.includes('note')) {
    openDetailModal.value = false;
  }
};

// --- THÊM MỚI: Xử lý ảnh cho trường hợp Không Lỗi ---
const noProblemImages = ref<Photo[]>([]);

const addNoProblemPhoto = async () => {
  // BƯỚC 1: Chặn ngay từ cửa nếu đã đủ 10 tấm
  if (noProblemImages.value.length >= 10) {
    await showToast('Chỉ được phép đính kèm tối đa 10 ảnh!', 'warning');
    return;
  }

  try {
    const image = await Camera.getPhoto({
      quality: 60, width: 1024, resultType: CameraResultType.Uri, source: CameraSource.Camera
    });
    if (image.webPath) {
      noProblemImages.value.push({ fileName: `ok_cam_${Date.now()}.jpg`, preview: image.webPath });
    }
  } catch (e) {
    console.log("Hủy chụp");
  }
};

const pickNoProblemImages = async () => {
  // BƯỚC 1: Tính toán slot trống và chặn từ cửa
  const slotsLeft = 10 - noProblemImages.value.length;
  if (slotsLeft <= 0) {
    await showToast('Đã đạt giới hạn 10 ảnh!', 'warning');
    return;
  }

  try {
    const result = await Camera.pickImages({ quality: 60, limit: slotsLeft });
    let photosToAdd = result.photos;

    // BƯỚC 2: Cắt mảng dự phòng (Đề phòng một số dòng điện thoại Tàu phớt lờ lệnh limit của OS)
    if (photosToAdd.length > slotsLeft) {
      await showToast(`Chỉ lấy ${slotsLeft} ảnh đầu tiên để không vượt quá giới hạn 10 ảnh.`, 'warning');
      photosToAdd = photosToAdd.slice(0, slotsLeft);
    }

    for (const photo of photosToAdd) {
      noProblemImages.value.push({ fileName: `ok_lib_${Date.now()}.jpg`, preview: photo.webPath });
    }
  } catch (e) {
    console.log("Hủy chọn");
  }
};

const removeNoProblemPhoto = (idx: number) => {
  noProblemImages.value.splice(idx, 1);
};

const handleCheckedNoProblem = () => {
  if (formData.prNoProblem) {
    // KHI TICK VÀO "Không lỗi": Xóa sạch dữ liệu của bên "Có lỗi" (nếu có)
    formData.prHasProblem = false;
    groupedNotes.value = [];
    selectedValues.value = [];
    formData.prNote = ''; // Reset note để bắt đầu nhập mới
  } else {
    // KHI BỎ TICK "Không lỗi": Xóa sạch ảnh và ghi chú vừa nhập
    noProblemImages.value = [];
    formData.prNote = '';
  }
};
// ----------------------------------------------------

// --- Submit Logic (Quan trọng nhất) ---
const isSubmitting = ref(false);
const handleSubmit = async (): Promise<void> => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  const now = new Date();
  const currentTimeString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);

  if (!dataScanQr.value?.cpId) {
    await showToast('Lỗi: Không tìm thấy dữ liệu Checkpoint', 'danger');
    return;
  }

  const loading = await loadingController.create({ message: 'Đang lưu dữ liệu...' });
  await loading.present();

  try {
    // THÊM MỚI: Chuẩn bị nguồn data tùy thuộc vào việc có chọn NoProblem hay không
    const sourceData = formData.prNoProblem
      ? [{
        prGroup: 1,
        priImageNote: formData.prNote || "Bình thường",
        reportImages: noProblemImages.value
      }]
      : groupedNotes.value.map(g => ({
        prGroup: g.prGroup,
        priImageNote: g.priImageNote,
        reportImages: g.reportImages
      }));

    // --- LOGIC MAP BASE64 VÀ GỌI ImageService.saveImage (Giữ nguyên của bạn, chỉ đổi tên mảng loop) ---
    const finalNoteGroups = await Promise.all(sourceData.map(async (group) => {
      const mappedImages = await Promise.all(group.reportImages.map(async (item) => {
        const response = await fetch(item.preview);
        const blob = await response.blob();
        let base64Data = (await convertBlobToBase64(blob)).split(',')[1];
        await ImageService.saveImage(base64Data);
        return { priImage: base64Data, priImageType: 'jpg' };
      }));

      return {
        prGroup: group.prGroup,
        priImageNote: group.priImageNote,
        reportImages: mappedImages
      };
    }));

    // Gom tất cả Base64 ra một mảng riêng để OfflineManager lưu file vật lý (phòng hờ sync sau)
    const allBase64ForStorage = finalNoteGroups.flatMap(ng => ng.reportImages.map(img => img.priImage));

    const currentCpId = dataScanQr.value.cpId;
    const routeId = store.state.routeId;
    const userId = store.state.dataUser?.userId || store.state.dataUser?.data?.userId;
    const scanAt = await storageService.get('currentTime_scanqr');
    const activeRoute = currentActiveRoute.value;
    const finalPsId = activeRoute?.psId || store.state.psId;

    // Tạo Payload hoàn chỉnh
    const formSubmitData = {
      psId: finalPsId,
      routeId: routeId,
      rdId: currentActiveRoute.value?.routeDetails.find(d => String(d.cpId) === String(currentCpId))?.rdId || '',
      createdAt: currentTimeString,
      prHasProblem: formData.prHasProblem,
      prNote: formData.prNote,
      cpId: currentCpId,
      createdBy: userId,
      prLat: 0,
      prLng: 0,
      prAccuracy: 0,
      scanAt: scanAt || currentTimeString,
      noteGroups: finalNoteGroups, // Sử dụng dữ liệu đã gộp
    };

    console.log(formSubmitData);

    // THÊM MỚI: Lấy ảnh đại diện (phụ thuộc vào việc có lỗi hay không)
    const firstPreview = formData.prNoProblem
      ? noProblemImages.value[0]?.preview
      : groupedNotes.value[0]?.reportImages[0]?.preview;

    await sendData(firstPreview || '', formSubmitData, allBase64ForStorage);

    // Cập nhật trạng thái và check Hoàn thành
    store.commit('UPDATE_POINT_STATUS', { routeId, cpId: currentCpId, status: 1 });

    const updatedRoutes = [...store.state.dataListRoute];
    const rIdx = updatedRoutes.findIndex(r =>
      Number(r.routeId) === Number(routeId) &&
      Number(r.psId) === Number(finalPsId)
    );
    const details = updatedRoutes[rIdx].routeDetails;
    const allDone = details.every((p: any) => p.status === 1);

    isResetting.value = true; // Khóa mồm watcher

    // Xóa tận gốc bản nháp trong CSDL máy
    if (currentCpId) {
      await storageService.remove(`draft_report_${currentCpId}`);
    }

    // Reset giao diện
    formData.prHasProblem = false;
    formData.prNoProblem = false; // THÊM MỚI
    formData.prNote = '';
    groupedNotes.value = [];
    selectedValues.value = [];
    tempNoteInput.value = '';
    noProblemImages.value = []; // THÊM MỚI

    setTimeout(() => { isResetting.value = false; }, 300);

    // --- BLOCK IF ALL DONE CỦA BẠN (GIỮ NGUYÊN 100%) ---
    if (allDone) {
      await clearTimer(routeId);

      await Promise.all([
        storageService.remove('unfinished_route_id'),
        storageService.remove('current_route_id'),
        storageService.remove('data_scanqr'),
        storageService.remove('currentTime_scanqr'),
        storageService.remove('current_ps_id')
      ]);

      store.commit('SET_UNFINISHED_ROUTE_ID', null);
      store.commit('SET_ROUTE_ID', null);
      store.commit('SET_PSID', null);
      store.commit('SET_DATASCANQR', null);

      await storageService.set('list_route', store.state.dataListRoute);

      await loading.dismiss();
      await showToast('Chúc mừng! Bạn đã hoàn thành toàn bộ lộ trình.', 'success');
      router.replace('/home');
    } else {
      await storageService.set('list_route', updatedRoutes);
      await storageService.set('unfinished_route_id', routeId);
      await loading.dismiss();
      router.replace('/route');
    }

  } catch (error) {
    await loading.dismiss();
    console.error("Lỗi:", error);
  } finally {
    isSubmitting.value = false;
  }
};

const handleGoBack = async () => {
  const details = currentActiveRoute.value?.routeDetails || [];
  const isFinished = details.every(p => p.status === 1);
  if (isFinished || details.length === 0) return router.replace('/route');

  const alert = await alertController.create({
    header: 'Cảnh báo',
    message: 'Bạn đang trong ca trực, hãy hoàn thành các điểm còn lại!',
    buttons: ['Đã hiểu']
  });
  await alert.present();
};

// --- Utils ---
const getCheckpointName = (cpId: string) => {
  const cp = currentActiveRoute.value?.routeDetails.find(d => String(d.cpId) === String(cpId));
  return cp ? cp.cpName : 'Điểm quét';
};

const formatDate = (ts: any) => new Date(ts).toLocaleTimeString();

const loadPendingItemsWithImages = async () => {
  await loadPendingItems();
  displayItems.value = await Promise.all(pendingItems.value.map(async (item: QueueItem) => ({
    ...item, thumb: item.imageFiles?.[0] ? await ImageService.getDisplayUrl(item.imageFiles[0]) : null
  })));
  console.log(displayItems.value);
};

const deleteItem = async (id: any) => {
  const queue = (await storageService.get('offline_api_queue')) || [];
  const item = queue.find((i: any) => i.id === id);
  if (item?.imageFiles) {
    for (const f of item.imageFiles) await ImageService.deleteImage(f);
  }
  await storageService.set('offline_api_queue', queue.filter((i: any) => i.id !== id));
  loadPendingItemsWithImages();
};

const showToast = async (m: string, c: string) => {
  const t = await toastController.create({ message: m, color: c, duration: 3000, position: 'top' });
  await t.present();
};

const draftKey = computed(() => {
  if (dataScanQr.value && dataScanQr.value.cpId) {
    return `draft_report_${dataScanQr.value.cpId}`;
  }
  return null;
});

let draftTimeout: any = null;

// THÊM MỚI: Bổ sung noProblemImages vào watcher lưu nháp
watch([formData, groupedNotes, selectedValues, noProblemImages], async () => {
  if (isResetting.value) return;

  if (draftTimeout) clearTimeout(draftTimeout);

  draftTimeout = setTimeout(async () => {
    if (draftKey.value && isReady.value) {
      const draftData = {
        prNoProblem: formData.prNoProblem,
        prHasProblem: formData.prHasProblem,
        prNote: formData.prNote,
        groupedNotes: JSON.parse(JSON.stringify(groupedNotes.value)),
        selectedValues: JSON.parse(JSON.stringify(selectedValues.value)),
        noProblemImages: JSON.parse(JSON.stringify(noProblemImages.value)) // THÊM MỚI
      };
      await storageService.set(draftKey.value, draftData);
      console.log('Đã lưu nháp ngầm!');
    }
  }, 500);
}, { deep: true });

const loadDraft = async () => {
  if (!draftKey.value) return false;

  const draft: any = await storageService.get(draftKey.value);
  if (draft) {
    formData.prHasProblem = draft.prHasProblem || false;
    formData.prNoProblem = draft.prNoProblem || false; // THÊM MỚI
    formData.prNote = draft.prNote || '';
    groupedNotes.value = draft.groupedNotes || [];
    selectedValues.value = draft.selectedValues || [];
    noProblemImages.value = draft.noProblemImages || []; // THÊM MỚI
    console.log('✅ Đã khôi phục bản nháp đang nhập dở');
    return true;
  }
  return false;
};

// --- Lifecycle ---
onIonViewWillEnter(async () => {
  setTimeout(async () => {
    const hasDraft = await loadDraft();
    if (!hasDraft) {
      formData.prNote = '';
      formData.prHasProblem = false;
      formData.prNoProblem = false; // THÊM MỚI
      groupedNotes.value = [];
      selectedValues.value = [];
      noProblemImages.value = []; // THÊM MỚI
    }
  }, 100);
});

// HOOK NÀY MÌNH ĐÃ TRẢ LẠI 100% CHO BẠN
onIonViewDidLeave(() => {
  isResetting.value = true;

  formData.prHasProblem = false;
  formData.prNoProblem = false; // THÊM MỚI
  formData.prNote = '';
  groupedNotes.value = [];
  selectedValues.value = [];
  tempNoteInput.value = '';
  noProblemImages.value = []; // THÊM MỚI

  openCategoryModal.value = false;
  openDetailModal.value = false;
  openNoteModal.value = false;

  setTimeout(() => { isResetting.value = false; }, 300);
});

onMounted(async () => {
  const routeId = route.query.routeId || store.state.routeId;

  if (routeId) {
    store.commit('SET_UNFINISHED_ROUTE_ID', Number(routeId));
    await storageService.set('unfinished_route_id', Number(routeId));
  }

  if (!store.state.isHydrated) await store.dispatch('initApp');
  await loadPendingItemsWithImages();

  const catData = store.state.dataReportNoteCategory;
  if (catData) {
    const rawArray = Array.isArray(catData) ? catData : (catData.data || []);
    apiCategories.value = markRaw(rawArray);
  }

  isReady.value = true;
  App.addListener('backButton', handleGoBack);
});
</script>

<style scoped>
.padding-top {
  padding-top: 25px;
}

.pad-0 {
  padding: 0;
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

.icon-cloud {
  display: flex;
  align-items: center;
  justify-content: center;
}

.info-offline {
  display: flex;
}

.badge-offline {
  margin-right: 4px;
  color: white;
}

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

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f0f0;
  border: 1px dashed #ccc;
  border-radius: 4px;
}

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
</style>