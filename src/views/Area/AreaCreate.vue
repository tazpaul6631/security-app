<template>
  <ion-page>
    <ion-header>
      <ion-toolbar class="none-padding">
        <ion-buttons slot="start">
          <ion-button @click="handleGoBack">
            <ion-icon slot="icon-only" :icon="arrowBackOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ $t('page.areas.report') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="isReady && dataScanQr">
        <checkpoint-info-card :dataScanQr="dataScanQr" :currentActiveRoute="currentActiveRoute"
          :formattedTime="formattedTime" :timerColorClass="timerColorClass" />

        <ion-card v-if="mandatoryPhoto">
          <ion-card-content>
            <ion-item v-if="!formData.prHasProblem" lines="none">
              {{ $t('areas.report.no-issue') }}
            </ion-item>

            <transition name="smooth-collapse">
              <div v-if="!formData.prHasProblem">
                <ion-row>
                  <ion-col>
                    <ion-button class="btn-camera" expand="block" size="small" @click="addNoProblemPhoto">
                      <ion-icon slot="start" :icon="camera"></ion-icon> {{ $t('areas.report.camera') }}
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
                    <ion-textarea :label="$t('areas.report.content')" label-placement="floating" fill="outline"
                      v-model="formData.prNote" :rows="4" :placeholder="$t('areas.report.placeholder-input')">
                    </ion-textarea>
                  </ion-col>
                </ion-row>
              </div>
            </transition>

            <ion-item lines="none">
              <ion-checkbox v-model="formData.prHasProblem" @ionChange="handleCheckedHasProblem">
                {{ $t('areas.report.issue-detected') }}
              </ion-checkbox>
            </ion-item>

            <transition name="smooth-collapse">
              <div v-if="formData.prHasProblem">
                <ion-row>
                  <ion-col>
                    <ion-button class="btn-status" expand="block" fill="outline" @click="openCategoryModal = true">
                      <ion-icon slot="start" :icon="images"></ion-icon>
                      {{ $t('areas.report.select-status') }} ({{ groupedNotes.length }})
                    </ion-button>
                  </ion-col>
                </ion-row>
              </div>
            </transition>
          </ion-card-content>
        </ion-card>

        <ion-card v-if="mandatoryPhoto">
          <ion-card-content>
            <ion-button class="btn-submit" expand="block" color="success" :disabled="isSubmitting"
              @click="confirmSubmit">
              <ion-icon slot="start" :icon="sendOutline"></ion-icon>
              {{ $t('areas.report.btn-submit') }}
            </ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card class="ion-margin-bottom">
          <ion-card-content class="ion-text-center">
            <div v-if="!mandatoryPhoto">
              <p><b class="require">{{ $t('areas.report.label_requirement') }}</b> {{
                $t('areas.report.msg_capture_before_report') }}</p>
              <ion-button expand="block" @click="captureMandatoryPhoto" class="btn-camera">
                <ion-icon slot="start" :icon="camera"></ion-icon>
                {{ $t('areas.report.btn_take_checkin') }}
              </ion-button>
            </div>

            <div v-else>
              <div class="mandatory-img-container">
                <ion-img :src="mandatoryPhoto.preview" class="thumb-img" />
                <!-- <div class="delete-btn" @click="removeMandatoryPhoto">
                  <ion-icon :icon="trash"></ion-icon>
                </div> -->
              </div>
              <strong class="accept-img">
                <ion-icon :icon="checkmarkCircleOutline"></ion-icon> {{ $t('areas.report.status_photo_confirmed') }}
              </strong>
            </div>
          </ion-card-content>
        </ion-card>
      </div>

      <category-modal :is-open="openCategoryModal" :api-categories="apiCategories" :grouped-notes="groupedNotes"
        @close="openCategoryModal = false" @selectCategory="selectSubCategory" @removeGroup="removeGroup"
        @addPhoto="addGroupPhoto" @pickPhotos="pickGroupImages" @removePhoto="handleRemoveGroupPhoto" />

      <issue-detail-modal :is-open="openDetailModal" :selectedSubCategory="selectedSubCategory"
        :currentIssues="currentIssues" :selectedValues="selectedValues" @close="openDetailModal = false"
        @toggleIssue="toggleIssue" @confirm="confirmDetails" />

      <note-input-modal :is-open="openNoteModal" @close="openNoteModal = false" @confirm="handleConfirmNote" />

      <offline-sync-list :displayItems="displayItems" :paginatedItems="paginatedItems" :loadedCount="loadedCount"
        :getCheckpointName="getCheckpointName" @delete="deleteItem" @loadMore="loadMoreOfflineItems" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch, markRaw } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonTextarea,
  IonCheckbox, IonButton, IonIcon, IonCard, IonCardContent, IonGrid, IonRow,
  IonCol, IonImg, loadingController, onIonViewWillEnter,
  IonButtons, onIonViewDidLeave, alertController, useBackButton
} from '@ionic/vue';
import {
  sendOutline, camera, images, trash, arrowBackOutline, checkmarkCircleOutline
} from 'ionicons/icons';
import { useStore } from 'vuex';
import { useOfflineManager } from '@/composables/useOfflineManager';
import { ImageService } from '@/services/image.service';
import router from '@/router';
import storageService from '@/services/storage.service';
import { useRouteTimer } from '@/composables/useRouteTimer';
import { useRoute } from 'vue-router';
import { Geolocation } from '@capacitor/geolocation';
import CheckpointInfoCard from '@/components/CheckpointInfoCard.vue';
import OfflineSyncList from '@/components/OfflineSyncList.vue';
import NoteInputModal from '@/components/modals/NoteInputModal.vue';
import IssueDetailModal from '@/components/modals/IssueDetailModal.vue';
import CategoryModal from '@/components/modals/CategoryModal.vue';
import { useCameraHandler } from '@/composables/useCameraHandler';
import { useI18n } from 'vue-i18n';

// Lấy 3 hàm xịn xò ra xài
const { takePhoto, pickImagesFromGallery, convertBlobToBase64, showToast } = useCameraHandler();

// --- Global Timer Composable ---
const { startTimer, clearTimer, formattedTime, timerColorClass } = useRouteTimer();

const store = useStore();
const isReady = ref(false);
const route = useRoute();
const { t } = useI18n();

// --- Interfaces ---
interface RouteDetail { rdId: number | string; cpId: number | string; cpName: string; status: number; rdIsComplete: boolean; }
interface Route {
  routeId: number; routeName: string; routeCode: string;
  psHourFrom: number; psHourTo: number; planMaxSecond?: number; planMinSecond?: number;
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
  if (newRoute && newRoute.routeId && newRoute.planMaxSecond && newRoute.planMinSecond) {
    await storageService.set('unfinished_route_id', newRoute.routeId);
    await startTimer(newRoute.routeId, newRoute.planMaxSecond, newRoute.planMinSecond);
  }
}, { immediate: true });

// --- Xử lý Dữ liệu QR ---
const dataScanQr = computed(() => {
  const rawData = store.state.dataScanQr;
  if (!rawData) return null;
  return rawData.data?.data || rawData.data || rawData;
});

// --- Form State ---
const formData = reactive({ prHasProblem: false, prNote: '', cpId: '', rpLat: null as number | null, rpLng: null as number | null });
const groupedNotes = ref<GroupedNote[]>([]);
const apiCategories = ref<ReportNode[]>([]);
const selectedSubCategory = ref<ReportNode | null>(null);
const selectedValues = ref<string[]>([]);
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
///////////////////////////////////////////////////////

// --- Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const handleCheckedHasProblem = () => {
  if (formData.prHasProblem) {
    noProblemImages.value = [];
    formData.prNote = '';
  } else {
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

const handleConfirmNote = (text: string) => {
  groupedNotes.value.push({
    id: generateId(),
    prGroup: groupedNotes.value.length + 1,
    priImageNote: text,
    reportImages: [],
    type: 'note'
  });
  syncToMainForm();
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

const toggleIssue = (val: string) => {
  const index = selectedValues.value.indexOf(val);
  if (index > -1) {
    selectedValues.value.splice(index, 1);
  } else {
    selectedValues.value.push(val);
  }
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

// Xử lý ảnh cho trường hợp Không Lỗi ---
const noProblemImages = ref<Photo[]>([]);

const confirmSubmit = async () => {
  if (formData.prHasProblem && groupedNotes.value.length === 0) {
    return showToast(t('areas.report.select-status'), 'warning');
  }

  const alert = await alertController.create({
    header: t('areas.report.message.7'),
    message: t('areas.report.message.11'),
    buttons: [
      {
        text: t('areas.report.close'),
        role: 'cancel',
        cssClass: 'secondary',
      },
      {
        text: t('areas.report.btn-submit'),
        handler: () => {
          handleSubmit();
        },
      },
    ],
  });

  await alert.present();
};

// --- Submit Logic ---
const isSubmitting = ref(false);
const handleSubmit = async (): Promise<void> => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;

  const now = new Date();
  const currentTimeString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);

  if (!dataScanQr.value?.cpId) {
    await showToast(t('areas.report.message.1'), 'danger');
    isSubmitting.value = false;
    return;
  }

  const loading = await loadingController.create({ message: t('areas.report.message.2') });
  await loading.present();

  try {
    const sourceData: any[] = [];
    const allBase64ForStorage: string[] = []; // Đây là nơi chứa data ảnh thực tế

    // --- GOM NHÓM DỮ LIỆU ---
    if (mandatoryPhoto.value) {
      sourceData.push({
        prGroup: 1,
        priImageNote: t('areas.report.validate-img'),
        reportImages: [mandatoryPhoto.value]
      });
    }

    if (!formData.prHasProblem) {
      if (noProblemImages.value.length > 0) {
        sourceData.push({
          prGroup: 2,
          priImageNote: formData.prNote || t('areas.report.no-issue'),
          reportImages: [...noProblemImages.value]
        });
      }
    } else {
      groupedNotes.value.forEach((g, index) => {
        sourceData.push({
          prGroup: index + 2,
          priImageNote: g.priImageNote,
          reportImages: g.reportImages
        });
      });
    }

    // --- XỬ LÝ ẢNH ---
    const finalNoteGroups: any[] = [];
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
    const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    for (const group of sourceData) {
      const mappedImages: any[] = [];

      for (const item of group.reportImages) {
        try {
          const response = await fetch(item.preview);
          const blob = await response.blob();

          // 1. Kiểm tra định dạng (Mime Type)
          if (!ALLOWED_MIMES.includes(blob.type)) {
            await loading.dismiss();
            await showToast(t('areas.report.message.3').replace('${blob.type}', blob.type), 'danger');
            isSubmitting.value = false;
            return; // Dừng submit ngay lập tức
          }

          // 2. Kiểm tra dung lượng ảnh (Size)
          if (blob.size > MAX_IMAGE_SIZE) {
            await loading.dismiss();
            // Convert ra MB để hiển thị cho thân thiện
            const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
            await showToast(t('areas.report.message.4').replace('${sizeInMB}', sizeInMB), 'danger');
            isSubmitting.value = false;
            return; // Dừng submit ngay lập tức
          }

          const base64Full = await convertBlobToBase64(blob);
          const base64Data = base64Full.split(',')[1];

          allBase64ForStorage.push(base64Data);

          const fileExt = (blob.type && blob.type.includes('/')) ? blob.type.split('/')[1] : 'jpg';
          mappedImages.push({
            priImage: "",
            priImageType: fileExt
          });
        } catch (imgError) {
          console.error("Lỗi xử lý ảnh:", imgError);
          await showToast(t('areas.report.message.11'), 'danger');
          continue; // Bỏ qua ảnh lỗi, vẫn tiếp tục xử lý các ảnh khác
        }
      }

      finalNoteGroups.push({
        prGroup: group.prGroup,
        priImageNote: group.priImageNote,
        reportImages: mappedImages
      });
    }

    // --- TẠO PAYLOAD JSON SẠCH ---
    const currentCpId = dataScanQr.value.cpId;
    const routeId = store.state.routeId;
    const userId = store.state.dataUser?.userId || store.state.dataUser?.data?.userId;
    const scanAt = await storageService.get('currentTime_scanqr');
    const activeRoute = currentActiveRoute.value;
    const finalPsId = activeRoute?.psId || store.state.psId;

    syncToMainForm();

    const formSubmitData = {
      psId: finalPsId,
      routeId: routeId,
      rdId: currentActiveRoute.value?.routeDetails.find(d => String(d.cpId) === String(currentCpId))?.rdId || 0,
      createdAt: currentTimeString,
      prHasProblem: formData.prHasProblem,
      prNote: formData.prNote,
      cpId: currentCpId,
      createdBy: userId,
      scanAt: scanAt || currentTimeString,
      rpLat: formData.rpLat,
      rpLng: formData.rpLng,
      noteGroups: finalNoteGroups,
    };

    // --- GỬI QUA OFFLINE MANAGER ---
    // firstPreview dùng để làm ảnh đại diện thumbnail trong danh sách chờ
    const firstPreview = mandatoryPhoto.value?.preview ||
      (formData.prHasProblem ? groupedNotes.value[0]?.reportImages[0]?.preview : noProblemImages.value[0]?.preview);

    // sendData sẽ nhận mảng allBase64ForStorage, lưu thành file và dùng buildFormData để gửi IFormFile
    await sendData(firstPreview || '', formSubmitData, allBase64ForStorage);

    // --- RESET VÀ CHUYỂN TRANG ---
    store.commit('UPDATE_POINT_STATUS', { routeId, cpId: currentCpId, status: 1 });
    const updatedRoutes = [...store.state.dataListRoute];
    const rIdx = updatedRoutes.findIndex((r: Route) => Number(r.routeId) === Number(routeId) && Number(r.psId) === Number(finalPsId));
    const allDone = updatedRoutes[rIdx].routeDetails.every((p: any) => p.rdIsComplete);

    isResetting.value = true;
    if (currentCpId) await storageService.remove(`draft_report_${currentCpId}`);

    // Clear dữ liệu form
    formData.prHasProblem = false;
    formData.prNote = '';
    groupedNotes.value = [];
    selectedValues.value = [];
    noProblemImages.value = [];
    mandatoryPhoto.value = null;

    setTimeout(() => { isResetting.value = false; }, 300);

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
      await showToast(t('areas.report.message.5'), 'success');
      router.replace('/home');
    } else {
      await storageService.set('list_route', updatedRoutes);
      await loading.dismiss();
      router.replace('/route');
    }

  } catch (error) {
    await loading.dismiss();
    console.error("Lỗi:", error);
    await showToast(t('areas.report.message.6'), 'danger');
  } finally {
    isSubmitting.value = false;
  }
};

const handleGoBack = async () => {
  const details = currentActiveRoute.value?.routeDetails || [];
  const isFinished = details.every((p: RouteDetail) => p.rdIsComplete);
  if (isFinished || details.length === 0) return router.replace('/route');

  const alert = await alertController.create({
    header: t('areas.report.message.7'),
    message: t('areas.report.message.8'),
    buttons: [t('areas.report.message.9')]
  });
  await alert.present();
};

// --- Utils ---
const getCheckpointName = (cpId: string) => {
  const cp = currentActiveRoute.value?.routeDetails.find(d => String(d.cpId) === String(cpId));
  return cp ? cp.cpName : 'Điểm quét';
};

const loadPendingItemsWithImages = async () => {
  await loadPendingItems();
  displayItems.value = await Promise.all(pendingItems.value.map(async (item: QueueItem) => ({
    ...item, thumb: item.imageFiles?.[0] ? await ImageService.getDisplayUrl(item.imageFiles[0]) : null
  })));
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

////////////////////////////////////////////
// ==========================================
// XỬ LÝ ẢNH CHO: CÓ PHÁT HIỆN SỰ CỐ (GROUP)
// ==========================================
const addGroupPhoto = async (idx: number) => {
  groupedNotes.value[idx].isAddingPhoto = true;

  const currentCount = groupedNotes.value[idx].reportImages.length;
  const photo = await takePhoto(currentCount, 'err_cam_');

  if (photo) {
    groupedNotes.value[idx].reportImages.push(photo);
  }

  groupedNotes.value[idx].isAddingPhoto = false;
};

const pickGroupImages = async (idx: number) => {
  groupedNotes.value[idx].isAddingPhoto = true;

  const currentCount = groupedNotes.value[idx].reportImages.length;
  const photos = await pickImagesFromGallery(currentCount, 'err_lib_');

  if (photos.length > 0) {
    groupedNotes.value[idx].reportImages.push(...photos);
  }

  groupedNotes.value[idx].isAddingPhoto = false;
};

const handleRemoveGroupPhoto = (payload: { gIdx: number, pIdx: number }) => {
  groupedNotes.value[payload.gIdx].reportImages.splice(payload.pIdx, 1);
};


// ==========================================
// XỬ LÝ ẢNH CHO: KHÔNG CÓ LỖI (NO PROBLEM)
// ==========================================
const addNoProblemPhoto = async () => {
  const currentCount = noProblemImages.value.length;
  const photo = await takePhoto(currentCount, 'ok_cam_');

  if (photo) {
    noProblemImages.value.push(photo);
  }
};

const removeNoProblemPhoto = (idx: number) => {
  noProblemImages.value.splice(idx, 1);
};
////////////////////////////////////////////

/////////////////////////////////////////
// Biến lưu ảnh bắt buộc
const mandatoryPhoto = ref<Photo | null>(null);

// Hàm vẽ Watermark (ngày giờ) lên ảnh (Sử dụng FileReader thuần)
const addWatermarkToImage = async (imageSrc: string, text: string, textColor: string = '#FFD700'): Promise<string> => {
  return new Promise(async (resolve) => {
    try {
      let base64Data = imageSrc;

      if (!imageSrc.startsWith('data:image')) {
        const response = await fetch(imageSrc);
        const blob = await response.blob();

        base64Data = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) return resolve(base64Data);

        ctx.drawImage(img, 0, 0);

        const fontSize = Math.max(Math.floor(img.height * 0.05), 25);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const padding = 30;
        const x = padding;
        const y = padding;

        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x - 10, y - 10, textWidth + 20, fontSize + 20);

        ctx.fillStyle = textColor;
        ctx.fillText(text, x, y);

        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };

      img.onerror = (err) => {
        console.error("Image load error in canvas:", err);
        resolve(base64Data);
      };

      img.src = base64Data;
    } catch (error) {
      console.error("Watermark generation error:", error);
      resolve(imageSrc);
    }
  });
};

// Hàm chụp ảnh bắt buộc
const captureMandatoryPhoto = async () => {
  // --- KIỂM TRA VÀ LẤY GPS TRƯỚC ---
  try {
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted') {
      const request = await Geolocation.requestPermissions();
      if (request.location !== 'granted') {
        await showToast(t('areas.report.message.location_permission'), 'warning');
        return;
      }
    }

    const loadingGps = await loadingController.create({
      message: t('areas.report.message.fetching_gps')
    });
    await loadingGps.present();

    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 0
      });
      formData.rpLat = coordinates.coords.latitude;
      formData.rpLng = coordinates.coords.longitude;
    } catch (highAccuracyError) {
      try {
        // NẾU THẤT BẠI DO Ở TRONG XƯỞNG TÔN HOẶC TIMEOUT, DÙNG VỊ TRÍ MẠNG
        const fallbackCoords = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 4000, // Đợi tối đa 4 giây
          maximumAge: 60000 // Chấp nhận xài lại vị trí đã cache trong vòng 1 phút trước đó
        });

        formData.rpLat = fallbackCoords.coords.latitude;
        formData.rpLng = fallbackCoords.coords.longitude;

      } catch (fallbackError) {
        await loadingGps.dismiss();
        await showToast(t('areas.report.message.gps_not_available'), 'danger');
        return; // Dừng, không mở camera
      }
    }
    await loadingGps.dismiss();
  } catch (err) {
    console.error("Lỗi cấp quyền GPS:", err);
    await showToast(t('areas.report.message.gps_error'), 'warning');
    return;
  }

  const photo = await takePhoto(0, 'checkin_');

  if (photo) {
    const loading = await loadingController.create({ message: t('areas.report.message.10') });
    await loading.present();

    try {
      const now = new Date();
      const timeString = now.toLocaleString('vi-VN', {
        hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      // LOGIC KIỂM TRA LỐ CA (TRỄ GIỜ)
      let isLate = false;
      const activeRoute = currentActiveRoute.value;

      if (activeRoute && activeRoute.psHourFrom !== undefined) {
        const currentHour = now.getHours();

        if (currentHour !== activeRoute.psHourFrom) {
          isLate = true;
        }
      }

      const watermarkColor = isLate ? '#FF0000' : '#FFD700';

      const watermarkedBase64 = await addWatermarkToImage(photo.preview, timeString, watermarkColor);

      mandatoryPhoto.value = {
        fileName: photo.fileName,
        preview: watermarkedBase64
      };
    } finally {
      await loading.dismiss();
    }
  }
};

// const removeMandatoryPhoto = () => {
//   mandatoryPhoto.value = null;
// };
/////////////////////////////////////////

const draftKey = computed(() => {
  if (dataScanQr.value && dataScanQr.value.cpId) {
    return `draft_report_${dataScanQr.value.cpId}`;
  }
  return null;
});

let draftTimeout: any = null;

watch([formData, groupedNotes, selectedValues, noProblemImages, mandatoryPhoto], async () => {
  if (isResetting.value) return;

  if (draftTimeout) clearTimeout(draftTimeout);

  draftTimeout = setTimeout(async () => {
    if (draftKey.value && isReady.value) {
      const draftData = {
        prHasProblem: formData.prHasProblem,
        prNote: formData.prNote,
        rpLat: formData.rpLat,
        rpLng: formData.rpLng,
        groupedNotes: JSON.parse(JSON.stringify(groupedNotes.value)),
        selectedValues: JSON.parse(JSON.stringify(selectedValues.value)),
        noProblemImages: JSON.parse(JSON.stringify(noProblemImages.value)),
        mandatoryPhoto: JSON.parse(JSON.stringify(mandatoryPhoto.value))
      };
      await storageService.set(draftKey.value, draftData);
      console.log('Đã lưu nháp bao gồm cả ảnh bắt buộc!');
    }
  }, 500);
}, { deep: true });

const loadDraft = async () => {
  if (!draftKey.value) return false;

  const draft: any = await storageService.get(draftKey.value);
  if (draft) {
    formData.prHasProblem = draft.prHasProblem || false;
    formData.prNote = draft.prNote || '';
    formData.rpLat = draft.rpLat || null;
    formData.rpLng = draft.rpLng || null;
    groupedNotes.value = draft.groupedNotes || [];
    selectedValues.value = draft.selectedValues || [];
    noProblemImages.value = draft.noProblemImages || [];
    mandatoryPhoto.value = draft.mandatoryPhoto || null;
    console.log('Đã khôi phục toàn bộ bản nháp!');
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
      groupedNotes.value = [];
      selectedValues.value = [];
      noProblemImages.value = [];
    }
  }, 100);
});

onIonViewDidLeave(async () => {
  isResetting.value = true;
  formData.prHasProblem = false;
  formData.prNote = '';
  groupedNotes.value = [];
  selectedValues.value = [];
  noProblemImages.value = [];

  selectedSubCategory.value = null;

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
});

useBackButton(10, () => {
  handleGoBack();
});
</script>

<style scoped>
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

.btn-submit {
  --ion-color-contrast: white !important;
}

.btn-status,
.btn-submit,
.btn-camera {
  height: 40px;
  font-size: 16px;
  font-weight: bold;
}

.accept-img {
  color: green;
  display: flex;
  justify-content: center;
  align-items: center;
}

.accept-img ion-icon {
  margin-right: 4px;
}

.mandatory-img-container {
  width: 100%;
  height: 40vh;
  background-color: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 10px;
}

.mandatory-img-container .thumb-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.require {
  color: red;
}

/* --- Smooth Collapse Animation --- */
.smooth-collapse-enter-active,
.smooth-collapse-leave-active {
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.35s ease-in-out,
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  max-height: 800px;
}

.smooth-collapse-enter-from,
.smooth-collapse-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-15px);
}
</style>