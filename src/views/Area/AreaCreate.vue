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
  IonCol, IonImg, loadingController, onIonViewWillEnter, toastController,
  IonButtons, onIonViewDidLeave, alertController
} from '@ionic/vue';
import {
  sendOutline, camera, images, trash, arrowBackOutline
} from 'ionicons/icons';
import { useStore } from 'vuex';
import { useOfflineManager } from '@/composables/useOfflineManager';
import { ImageService } from '@/services/image.service';
import router from '@/router';
import storageService from '@/services/storage.service';
import { App } from '@capacitor/app';
import { useRouteTimer } from '@/composables/useRouteTimer';
import { useRoute } from 'vue-router';

import CheckpointInfoCard from '@/components/CheckpointInfoCard.vue';
import OfflineSyncList from '@/components/OfflineSyncList.vue';
import NoteInputModal from '@/components/modals/NoteInputModal.vue';
import IssueDetailModal from '@/components/modals/IssueDetailModal.vue';
import CategoryModal from '@/components/modals/CategoryModal.vue';
import { useCameraHandler } from '@/composables/useCameraHandler';

// Lấy 3 hàm xịn xò ra xài
const { takePhoto, pickImagesFromGallery, convertBlobToBase64, showToast } = useCameraHandler();

// --- Global Timer Composable ---
const { startTimer, clearTimer, formattedTime, timerColorClass } = useRouteTimer();

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
    formData.prNote = '';
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

const handleCheckedNoProblem = () => {
  if (formData.prNoProblem) {
    // KHI TICK VÀO "Không lỗi": Xóa sạch dữ liệu của bên "Có lỗi" (nếu có)
    formData.prHasProblem = false;
    groupedNotes.value = [];
    selectedValues.value = [];
    formData.prNote = '';
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
    let loc = store.state.currentLocation;
    if (!loc) {
      loc = await storageService.get('last_known_location') || { lat: 0, lng: 0, accuracy: 0 };
    }

    console.log(dataScanQr.value);

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
      cpLat: dataScanQr.value.cpLat,
      cpLng: dataScanQr.value.cpLng,
      prLat: loc.lat,
      prLng: loc.lng,
      prAccuracy: loc.accuracy,
      scanAt: scanAt || currentTimeString,
      noteGroups: finalNoteGroups,
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

    isResetting.value = true;

    // Xóa tận gốc bản nháp trong CSDL máy
    if (currentCpId) {
      await storageService.remove(`draft_report_${currentCpId}`);
    }

    // Reset giao diện
    formData.prHasProblem = false;
    formData.prNoProblem = false;
    formData.prNote = '';
    groupedNotes.value = [];
    selectedValues.value = [];
    noProblemImages.value = [];
    selectedSubCategory.value = null;

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

const pickNoProblemImages = async () => {
  const currentCount = noProblemImages.value.length;
  const photos = await pickImagesFromGallery(currentCount, 'ok_lib_');

  if (photos.length > 0) {
    noProblemImages.value.push(...photos);
  }
};

const removeNoProblemPhoto = (idx: number) => {
  noProblemImages.value.splice(idx, 1);
};
////////////////////////////////////////////

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
        noProblemImages: JSON.parse(JSON.stringify(noProblemImages.value))
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
    formData.prNoProblem = draft.prNoProblem || false;
    formData.prNote = draft.prNote || '';
    groupedNotes.value = draft.groupedNotes || [];
    selectedValues.value = draft.selectedValues || [];
    noProblemImages.value = draft.noProblemImages || [];
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
      formData.prNoProblem = false;
      groupedNotes.value = [];
      selectedValues.value = [];
      noProblemImages.value = [];
    }
  }, 100);
});

// HOOK NÀY MÌNH ĐÃ TRẢ LẠI 100% CHO BẠN
onIonViewDidLeave(() => {
  isResetting.value = true;
  formData.prHasProblem = false;
  formData.prNoProblem = false;
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
  App.addListener('backButton', handleGoBack);
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
</style>