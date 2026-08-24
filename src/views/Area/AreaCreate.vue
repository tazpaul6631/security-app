<template>
  <div class="area-page">
    <header class="area-header">
      <h1 class="area-title">{{ $t('page.areas.report') }}</h1>
      <OfflineSyncHeaderButton :count="syncBadgeCount" @click="isOfflineSyncModalOpen = true" />
    </header>

    <AppPageContent class="area-content">
      <div class="area-bg" aria-hidden="true">
        <span class="area-blob area-blob-green" />
        <span class="area-blob area-blob-purple" />
      </div>

      <div v-if="isReady && dataScanQr && currentActiveRoute" class="area-body">
        <checkpoint-info-card :dataScanQr="dataScanQr" :currentActiveRoute="currentActiveRoute"
          :formattedTime="formattedTime" :timerColorClass="timerColorClass" />

        <Card v-if="mandatoryPhoto" class="area-card">
          <template #content>
            <p v-if="!formData.prHasProblem" class="section-label">{{ $t('areas.report.no-issue') }}</p>

            <transition name="smooth-collapse">
              <div v-if="!formData.prHasProblem" class="section-block">
                <Button :label="$t('areas.report.camera')" icon="pi pi-camera" class="btn-camera" fluid size="large"
                  @click="addNoProblemPhoto" />

                <div v-if="noProblemImages.length > 0" class="photo-grid">
                  <div v-for="(photo, pIdx) in noProblemImages" :key="pIdx" class="image-container">
                    <img :src="photo.preview" class="thumb-img" alt="" />
                    <button type="button" class="delete-btn" :aria-label="$t('areas.report.camera')" size="large"
                      @click="removeNoProblemPhoto(pIdx)">
                      <i class="pi pi-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div class="field-block">
                  <FloatLabel variant="on">
                    <Textarea id="pr-note" v-model="formData.prNote" rows="4" class="note-textarea" />
                    <label for="pr-note">{{ $t('areas.report.content') }}</label>
                  </FloatLabel>
                </div>
              </div>
            </transition>

            <div class="checkbox-row">
              <label for="has-problem" class="checkbox-label">{{ $t('areas.report.issue-detected') }}</label>
              <Checkbox v-model="formData.prHasProblem" input-id="has-problem" binary
                @update:model-value="handleCheckedHasProblem" />
            </div>

            <transition name="smooth-collapse">
              <div v-if="formData.prHasProblem" class="section-block">
                <Button :label="`${$t('areas.report.select-status')} (${groupedNotes.length})`" icon="pi pi-images"
                  severity="secondary" variant="outlined" class="btn-status" fluid size="large"
                  @click="openCategoryModal = true" />
              </div>
            </transition>

            <Button :label="$t('areas.report.btn-submit')" icon="pi pi-send" severity="success" class="btn-submit" fluid
              :disabled="isSubmitting" :loading="isSubmitting" size="large" @click="confirmSubmit" />
          </template>
        </Card>

        <Card class="area-card area-card-checkin">
          <template #content>
            <div v-if="!mandatoryPhoto" class="checkin-prompt">
              <p class="checkin-require">
                <b class="require">{{ $t('areas.report.label_requirement') }}</b>
                {{ $t('areas.report.msg_capture_before_report') }}
              </p>
              <Button :label="$t('areas.report.btn_take_checkin')" icon="pi pi-camera" class="btn-camera" fluid
                size="large" @click="captureMandatoryPhoto" />
            </div>

            <div v-else class="checkin-confirmed">
              <strong class="accept-img">
                <i class="pi pi-check-circle" aria-hidden="true" />
                {{ $t('areas.report.status_photo_confirmed') }}
              </strong>
              <div class="mandatory-img-container">
                <img :src="mandatoryPhoto.preview" class="mandatory-preview-img" alt="" />
              </div>
            </div>
          </template>
        </Card>
      </div>

      <category-modal :is-open="openCategoryModal" :api-categories="apiCategories" :grouped-notes="groupedNotes"
        @close="openCategoryModal = false" @removeGroup="removeGroup" @addPhoto="addGroupPhoto"
        @pickPhotos="pickGroupImages" @removePhoto="handleRemoveGroupPhoto" @toggleCategory="handleToggleCategory" />

      <note-input-modal :is-open="openNoteModal" @close="openNoteModal = false" @confirm="handleConfirmNote" />

      <Dialog v-model:visible="isSubmitConfirmOpen" modal :header="$t('areas.report.message.7')"
        class="submit-confirm-dialog" :style="{ width: 'min(92vw, 22rem)' }" :draggable="false" :closable="false"
        :close-on-escape="!isSubmitting" :dismissable-mask="!isSubmitting">
        <p class="submit-dialog-message">{{ $t('areas.report.message.11') }}</p>
        <template #footer>
          <Button :label="$t('areas.report.close')" severity="secondary" variant="outlined" :disabled="isSubmitting"
            size="large" @click="isSubmitConfirmOpen = false" />
          <Button :label="$t('areas.report.btn-submit')" icon="pi pi-send" severity="success" :loading="isSubmitting"
            size="large" :disabled="isSubmitting" @click="onConfirmSubmit" />
        </template>
      </Dialog>

      <OfflineSyncModal v-model:visible="isOfflineSyncModalOpen" :get-checkpoint-name="getCheckpointName" />
    </AppPageContent>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, onActivated, onDeactivated, watch, markRaw, nextTick } from 'vue';
import AppPageContent from '@/components/AppPageContent.vue';
import { useHardwareBackButton } from '@/composables/useHardwareBackButton';
import { useStore } from 'vuex';
import { Button, Card, Checkbox, Dialog, FloatLabel, Textarea } from '@/plugins/primevue.components';
import { useAppLoading } from '@/composables/useAppLoading';
import { useOfflineManager } from '@/composables/useOfflineManager';
import { useSyncBadgeCount } from '@/composables/useOfflineSyncDisplay';
import { useLogoutPrompt } from '@/composables/useLogoutPrompt';
import { ImageService } from '@/services/image.service';
import { speakImportantText } from '@/services/ttsService';
import router from '@/router';
import storageService from '@/services/storage.service';
import {
  upsertPointInPatrolShiftLog,
  finalizePatrolShiftLog,
} from '@/services/patrolShiftLog.service';
import { useRouteTimer } from '@/composables/useRouteTimer';
import { useRoute } from 'vue-router';
import { Geolocation } from '@capacitor/geolocation';
import CheckpointInfoCard from '@/components/CheckpointInfoCard.vue';
import OfflineSyncModal from '@/components/OfflineSyncModal.vue';
import OfflineSyncHeaderButton from '@/components/OfflineSyncHeaderButton.vue';
import NoteInputModal from '@/components/modals/NoteInputModal.vue';
import CategoryModal from '@/components/modals/CategoryModal.vue';
import { useCameraHandler } from '@/composables/useCameraHandler';
import { useI18n } from 'vue-i18n';
import {
  applySaveFileMismatchDebug,
  getDebugSubmitPreview,
  installImageDebugConsole,
  shouldSimulateWatermarkFail
} from '@/utils/imageDebug';
import { estimateBase64ByteSize, mimeFromPreview, previewToBase64, previewToBlob } from '@/utils/imagePayload';

// Lấy 3 hàm xịn xò ra xài
const { takePhoto, pickImagesFromGallery, showToast } = useCameraHandler();
const { show: showLoading, hide: hideLoading } = useAppLoading();

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
interface Photo { fileName: string; preview: string; submitBase64?: string; draftFileName?: string; }
interface GroupedNote { id: string; prGroup: number; priImageNote: string; reportImages: Photo[]; type: 'label' | 'note'; rncId?: string; isAddingPhoto?: boolean; }
interface ReportNode { rncId: number | string; rncName: string; childs?: ReportNode[]; }

// Ca trực đang active — đọc từ getter tập trung (usePatrolSession)
const currentActiveRoute = computed<Route | null>(() => store.getters.activeRoute as Route | null);

// Đồng bộ psId + timer khi xác định được ca trực chính xác
watch(() => currentActiveRoute.value, async (newRoute) => {
  if (newRoute?.psId) {
    store.commit('SET_PSID', newRoute.psId);
  }

  if (
    newRoute &&
    newRoute.routeId &&
    newRoute.planMaxSecond != null &&
    newRoute.planMinSecond != null
  ) {
    await storageService.set('unfinished_route_id', newRoute.routeId);
    await startTimer(newRoute.routeId, newRoute.psId, newRoute.planMaxSecond, newRoute.planMinSecond);
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
const selectedValues = ref<any[]>([]);
const isResetting = ref(false);

// Modals
const openCategoryModal = ref(false);
const openDetailModal = ref(false);
const openNoteModal = ref(false);
const isOfflineSyncModalOpen = ref(false);

const pendingNoteId = ref<string | null>(null);

const currentIssues = computed(() => selectedSubCategory.value?.childs || []);

// --- Offline Manager ---
const { sendData, loadPendingItems, pendingItems, syncData } = useOfflineManager();
const { syncBadgeCount } = useSyncBadgeCount();
const {
  markAwaitingLogoutAfterSync,
  tryPromptLogoutAfterOfflineSync,
} = useLogoutPrompt();

const buildPatrolLogInput = (
  activeRoute: any,
  completed: { cpId: number | string; cpCode: string; cpName: string },
  source: 'online' | 'offline'
) => {
  const user = store.state.dataUser;
  const userData = user?.data ? user.data : user;
  const scan = dataScanQr.value;

  return {
    psId: Number(activeRoute.psId),
    routeId: Number(activeRoute.routeId),
    psDay: Number(activeRoute.psDay ?? new Date().getDate()),
    psMonth: Number(activeRoute.psMonth ?? new Date().getMonth() + 1),
    psYear: Number(activeRoute.psYear ?? new Date().getFullYear()),
    psHourFrom: Number(activeRoute.psHourFrom ?? 0),
    routeName: String(activeRoute.routeName || ''),
    areaName: String(scan?.areaName || userData?.userAreaName || ''),
    reportBy: String(userData?.userId || ''),
    reportName: String(userData?.fullName || userData?.userName || userData?.userCode || ''),
    source,
    allPoints: (activeRoute.routeDetails || []).map((p: any) => ({
      cpId: p.cpId,
      cpCode: p.cpCode,
      cpName: p.cpName,
      rdIsComplete: !!(p.rdIsComplete || p.status === 1),
    })),
    completedPoint: completed,
  };
};

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

// Hàm xử lý khi user bấm vào nút (+) Thêm Note ở modal chi tiết
// const handleAddNoteIssue = (issue: any) => {
//   confirmDetails();
//   pendingNoteId.value = String(issue.rncId);
//   openNoteModal.value = true;
// };

// const selectSubCategory = (sub: ReportNode) => {
//   selectedSubCategory.value = sub;
//   selectedValues.value = (sub.childs || []).filter((child: any) =>
//     !child.isNote && groupedNotes.value.some(g => g.rncId === String(child.rncId))
//   );
//   openDetailModal.value = true;
// };

const handleConfirmNote = (text: string) => {
  groupedNotes.value.push({
    id: generateId(),
    prGroup: groupedNotes.value.length + 1,
    priImageNote: text,
    reportImages: [],
    type: 'note',
    rncId: pendingNoteId.value || '' // <-- GÁN ID VÀO ĐÂY
  });

  syncToMainForm();
  openNoteModal.value = false;
  openDetailModal.value = false;
  pendingNoteId.value = null; // Xóa tạm để dùng cho lần sau
};

const syncToMainForm = () => {
  formData.prNote = groupedNotes.value.map(g => g.priImageNote).join(', ');
};

const removeGroup = (idx: number) => {
  groupedNotes.value.splice(idx, 1);
  groupedNotes.value.forEach((g, i) => g.prGroup = i + 1);
  syncToMainForm();
};

// const toggleIssue = (issue: any) => {
//   // Tìm xem lỗi này đã được tích chọn trước đó chưa
//   const index = selectedValues.value.findIndex(v => String(v.rncId) === String(issue.rncId));

//   if (index > -1) {
//     // Nếu đã có rồi -> Xóa đi (Bỏ tích)
//     selectedValues.value.splice(index, 1);
//   } else {
//     // Nếu chưa có -> Thêm vào mảng (Tích chọn)
//     selectedValues.value.push(issue);
//   }
// };

// const confirmDetails = () => {
//   const subId = selectedSubCategory.value?.rncId;
//   if (!subId) return;

//   const currentChildLabelIds = (selectedSubCategory.value?.childs || [])
//     .filter((c: any) => !c.isNote) // Bỏ qua Note
//     .map((c: any) => String(c.rncId));

//   // BƯỚC 1: Xóa label bỏ chọn
//   groupedNotes.value = groupedNotes.value.filter((g: any) => {
//     if (currentChildLabelIds.includes(g.rncId)) {
//       return selectedValues.value.some(v => String(v.rncId) === g.rncId);
//     }
//     return true;
//   });

//   // BƯỚC 2: Thêm label mới tích
//   selectedValues.value.forEach((issue) => {
//     const exist = groupedNotes.value.some(g => g.rncId === String(issue.rncId));
//     if (!exist && !issue.isNote) {
//       groupedNotes.value.push({
//         id: generateId(),
//         prGroup: 0,
//         priImageNote: issue.rncName,
//         reportImages: [],
//         type: 'label',
//         rncId: String(issue.rncId)
//       });
//     }
//   });

//   groupedNotes.value.forEach((g, i) => g.prGroup = i + 1);
//   syncToMainForm();
//   openDetailModal.value = false;
// };

// Xử lý click thẳng vào mục không có child (ví dụ: Sự cố khác)
// const handleSelectDirectNote = (cat: any) => {
//   if (cat.isNote) {
//     // Luôn mở Note, KHÔNG check exist -> User bấm bao nhiêu lần tạo bấy nhiêu cái!
//     pendingNoteId.value = String(cat.rncId);
//     openNoteModal.value = true;
//   } else {
//     // Label bình thường thì vẫn chỉ cho phép add 1 cái
//     const exist = groupedNotes.value.some(g => g.rncId === String(cat.rncId));
//     if (!exist) {
//       groupedNotes.value.push({
//         id: generateId(),
//         prGroup: groupedNotes.value.length + 1,
//         priImageNote: cat.rncName,
//         reportImages: [],
//         type: 'label',
//         rncId: String(cat.rncId)
//       });
//       syncToMainForm();
//     }
//   }
// };

const handleToggleCategory = ({ cat, isChecked }: { cat: any, isChecked: boolean }) => {
  if (isChecked) {
    if (cat.isNote) {
      // Nếu là loại "Sự cố khác" (có nhập note) thì mở modal nhập Note
      pendingNoteId.value = String(cat.rncId);
      openNoteModal.value = true;
    } else {
      // Checkbox bình thường -> Thêm thẳng vào groupedNotes
      const exist = groupedNotes.value.some(g => g.rncId === String(cat.rncId));
      if (!exist) {
        groupedNotes.value.push({
          id: generateId(),
          prGroup: groupedNotes.value.length + 1,
          priImageNote: cat.rncName,
          reportImages: [],
          type: 'label',
          rncId: String(cat.rncId)
        });
        syncToMainForm();
      }
    }
  } else {
    // Nếu Uncheck -> Xóa khỏi danh sách groupedNotes
    groupedNotes.value = groupedNotes.value.filter(g => g.rncId !== String(cat.rncId));
    // Đánh số lại thứ tự
    groupedNotes.value.forEach((g, i) => g.prGroup = i + 1);
    syncToMainForm();
  }
};

// Xử lý ảnh cho trường hợp Không Lỗi ---
const noProblemImages = ref<Photo[]>([]);
const isSubmitConfirmOpen = ref(false);

const confirmSubmit = async () => {
  if (!mandatoryPhoto.value) {
    return showToast(t('areas.report.msg_capture_before_report'), 'warning');
  }

  if (formData.prHasProblem && groupedNotes.value.length === 0) {
    void speakImportantText(t('areas.report.select-status'));
    return showToast(t('areas.report.select-status'), 'warning');
  }

  if (formData.prHasProblem && groupedNotes.value.some(g => g.reportImages.length === 0)) {
    void speakImportantText(t('areas.report.img-status'));
    return showToast(t('areas.report.img-status'), 'warning');
  }

  isSubmitConfirmOpen.value = true;
};

const onConfirmSubmit = () => {
  if (isSubmitting.value) return;
  void handleSubmit();
};

// --- Submit Logic ---
const isSubmitting = ref(false);

/** noteGroups bắt buộc có nhóm check-in prGroup: 1 và ít nhất 1 ảnh */
const hasValidCheckinNoteGroup = (groups: any[]): boolean => {
  const checkinGroup = groups.find((g) => Number(g.prGroup) === 1);
  return !!(checkinGroup?.reportImages?.length);
};

const handleSubmit = async (): Promise<void> => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  showLoading(t('areas.report.message.2'));
  isSubmitConfirmOpen.value = false;
  await nextTick();

  const now = new Date();
  const currentTimeString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);

  if (!dataScanQr.value?.cpId) {
    hideLoading();
    await showToast(t('areas.report.message.1'), 'danger');
    isSubmitting.value = false;
    return;
  }

  if (!mandatoryPhoto.value) {
    hideLoading();
    await showToast(t('areas.report.msg_capture_before_report'), 'warning');
    isSubmitting.value = false;
    return;
  }

  const blockSubmitWithImageError = async (messageKey: string, resetCheckin = false) => {
    if (resetCheckin) {
      mandatoryPhoto.value = null;
    }
    hideLoading();
    await showToast(t(messageKey), 'danger');
    isSubmitting.value = false;
  };

  try {
    const sourceData: any[] = [];
    const allBase64ForStorage: string[] = [];
    const existingImageFiles: Array<string | null> = [];

    // --- GOM NHÓM DỮ LIỆU — nhóm 1 (check-in) luôn bắt buộc ---
    sourceData.push({
      prGroup: 1,
      priImageNote: t('areas.report.validate-img'),
      reportImages: [mandatoryPhoto.value],
      isCheckin: true
    });

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
          reportImages: g.reportImages,
          rncId: Number(g.rncId)
        });
      });
    }

    // --- XỬ LÝ ẢNH ---
    const finalNoteGroups: any[] = [];
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
    const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    const resolveMimeType = (blob: Blob, preview: string): string => {
      if (blob.type && ALLOWED_MIMES.includes(blob.type)) return blob.type;
      if (preview.startsWith('data:image/')) {
        const mime = preview.slice(5, preview.indexOf(';'));
        if (ALLOWED_MIMES.includes(mime)) return mime;
      }
      const lowerPreview = preview.toLowerCase();
      if (lowerPreview.includes('.png')) return 'image/png';
      if (lowerPreview.includes('.webp')) return 'image/webp';
      if (lowerPreview.includes('.gif')) return 'image/gif';
      return 'image/jpeg';
    };

    const expectedImageCount = sourceData.reduce(
      (sum, group) => sum + (group.reportImages?.length || 0),
      0
    );

    const processPhoto = async (item: any, isCheckin: boolean) => {
      try {
        const photoItem = item as Photo;
        const preview = getDebugSubmitPreview(
          photoItem.preview,
          isCheckin ? 'checkin' : 'report'
        );
        const useCachedBase64 =
          !!photoItem.submitBase64 && preview === photoItem.preview;
        const draftFileName =
          photoItem.draftFileName?.startsWith('offline_img_') ? photoItem.draftFileName : null;

        if (useCachedBase64) {
          const approxSize = estimateBase64ByteSize(photoItem.submitBase64!);
          if (approxSize > MAX_IMAGE_SIZE) {
            throw { resetCheckin: isCheckin };
          }

          const mimeType = mimeFromPreview(preview);
          if (!ALLOWED_MIMES.includes(mimeType)) {
            throw { resetCheckin: isCheckin };
          }

          const fileExt = mimeType.includes('/') ? mimeType.split('/')[1] : 'jpg';
          return {
            mapped: {
              priImage: '',
              priImageType: fileExt === 'jpeg' ? 'jpg' : fileExt
            },
            base64: photoItem.submitBase64!,
            draftFileName,
          };
        }

        const blob = await previewToBlob(preview);
        const mimeType = resolveMimeType(blob, preview);

        if (!ALLOWED_MIMES.includes(mimeType)) {
          throw { resetCheckin: isCheckin };
        }

        if (blob.size > MAX_IMAGE_SIZE) {
          throw { resetCheckin: isCheckin };
        }

        const base64Data = await previewToBase64(preview, photoItem.submitBase64);
        const fileExt = mimeType.includes('/') ? mimeType.split('/')[1] : 'jpg';
        return {
          mapped: {
            priImage: '',
            priImageType: fileExt === 'jpeg' ? 'jpg' : fileExt
          },
          base64: base64Data,
          draftFileName,
        };
      } catch (err: any) {
        if (err && typeof err === 'object' && 'resetCheckin' in err) throw err;
        throw { resetCheckin: isCheckin, cause: err };
      }
    };

    try {
      for (const group of sourceData) {
        const processed = await Promise.all(
          (group.reportImages || []).map((item: any) => processPhoto(item, !!group.isCheckin))
        );

        for (const photo of processed) {
          allBase64ForStorage.push(photo.base64);
          existingImageFiles.push(photo.draftFileName);
        }

        const noteGroup: any = {
          prGroup: group.prGroup,
          priImageNote: group.priImageNote,
          reportImages: processed.map((photo) => photo.mapped)
        };
        if (group.rncId) {
          noteGroup.rncId = group.rncId;
        }
        finalNoteGroups.push(noteGroup);
      }
    } catch (imgError: any) {
      console.error("Lỗi xử lý ảnh:", imgError);
      await blockSubmitWithImageError(
        imgError?.resetCheckin ? 'areas.report.message.13' : 'areas.report.message.14',
        !!imgError?.resetCheckin
      );
      return;
    }

    if (mandatoryPhoto.value && allBase64ForStorage.length === 0) {
      await blockSubmitWithImageError('areas.report.message.13', true);
      return;
    }

    if (allBase64ForStorage.length !== expectedImageCount) {
      await blockSubmitWithImageError('areas.report.message.14');
      return;
    }

    if (!hasValidCheckinNoteGroup(finalNoteGroups)) {
      await blockSubmitWithImageError('areas.report.message.13', true);
      return;
    }

    const hasEmptyImageGroup = finalNoteGroups.some(
      (g) => !g.reportImages || g.reportImages.length === 0
    );
    if (hasEmptyImageGroup) {
      await blockSubmitWithImageError('areas.report.message.14');
      return;
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

    // --- Ghi queue (disk + SQLite) TRƯỚC khi đánh dấu xong; mạng sync sau ---
    const firstPreview = mandatoryPhoto.value?.preview ||
      (formData.prHasProblem ? groupedNotes.value[0]?.reportImages[0]?.preview : noProblemImages.value[0]?.preview);

    const imagesForSend = applySaveFileMismatchDebug(allBase64ForStorage);
    const payloadForSend = { ...formSubmitData };
    const isDeviceOnline = !!store.state.isOnline;

    const reportSendError = async (sendErr: any) => {
      console.error('[AreaCreate] Gửi thất bại:', sendErr);
      const msg = sendErr?.message || '';
      if (msg === 'IMAGE_FILE_MISMATCH') {
        await showToast(t('areas.report.message.14'), 'danger');
      } else if (msg === 'MISSING_CHECKIN_GROUP' || msg === 'EMPTY_NOTE_GROUPS') {
        await showToast(t('areas.report.message.13'), 'danger');
      } else {
        await showToast(t('areas.report.message.6'), 'danger');
      }
    };

    let queuedImageFiles: string[] = [];
    try {
      queuedImageFiles = await sendData(
        firstPreview || '',
        payloadForSend,
        imagesForSend,
        existingImageFiles
      );
    } catch (sendErr: any) {
      await reportSendError(sendErr);
      hideLoading();
      isSubmitting.value = false;
      return;
    }

    // Ghi snapshot ca vào patrol_shift_logs (chỉ sau sendData OK)
    if (activeRoute) {
      const scan = dataScanQr.value;
      const pointMeta = {
        cpId: currentCpId,
        cpCode: String(scan?.cpCode || currentCpId),
        cpName: String(scan?.cpName || ''),
      };
      const logInput = buildPatrolLogInput(
        activeRoute,
        pointMeta,
        isDeviceOnline ? 'online' : 'offline'
      );
      try {
        await upsertPointInPatrolShiftLog(logInput);
      } catch (logErr) {
        console.warn('[AreaCreate] Ghi patrol_shift_logs thất bại:', logErr);
      }
    }

    store.commit('UPDATE_POINT_STATUS', { routeId, cpId: currentCpId, status: 1 });
    const updatedRoutes = [...store.state.dataListRoute];
    const rIdx = updatedRoutes.findIndex((r: Route) => Number(r.routeId) === Number(routeId) && Number(r.psId) === Number(finalPsId));
    const allDone = rIdx >= 0
      ? updatedRoutes[rIdx].routeDetails.every((p: any) => p.rdIsComplete)
      : false;

    isResetting.value = true;
    const draftFileToRemove = mandatoryPhoto.value?.draftFileName;
    if (draftKey.value) await storageService.remove(draftKey.value);
    if (draftFileToRemove && !queuedImageFiles.includes(draftFileToRemove)) {
      await deleteMandatoryDraftFile(draftFileToRemove);
    }

    formData.prHasProblem = false;
    formData.prNote = '';
    groupedNotes.value = [];
    selectedValues.value = [];
    noProblemImages.value = [];
    mandatoryPhoto.value = null;

    setTimeout(() => { isResetting.value = false; }, 300);

    const finishNavigate = async () => {
      if (allDone) {
        router.replace('/home');
      } else {
        router.replace('/route');
      }
    };

    if (allDone) {
      await clearTimer(routeId, finalPsId);

      // Snapshot đủ điểm lộ trình trước khi clear session
      if (activeRoute) {
        const scan = dataScanQr.value;
        const doneRoute = updatedRoutes[rIdx] || activeRoute;
        try {
          await finalizePatrolShiftLog(
            buildPatrolLogInput(
              doneRoute,
              {
                cpId: currentCpId,
                cpCode: String(scan?.cpCode || currentCpId),
                cpName: String(scan?.cpName || ''),
              },
              isDeviceOnline ? 'online' : 'offline'
            )
          );
        } catch (logErr) {
          console.warn('[AreaCreate] finalize patrol_shift_logs thất bại:', logErr);
        }
      }

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

      hideLoading();
      void finishNavigate();

      void (async () => {
        // Đánh dấu: xong ca — nếu còn pending sẽ hỏi logout sau khi sync sạch
        await markAwaitingLogoutAfterSync();

        await storageService.set('list_route', store.state.dataListRoute);
        await loadPendingItems({ sanitize: true });

        // Online còn queue → thử sync rồi kiểm tra lại trước khi hỏi đăng xuất
        if (isDeviceOnline && pendingItems.value.length > 0) {
          try {
            await syncData();
          } catch (syncErr) {
            console.warn('[AreaCreate] Sync sau hoàn thành ca thất bại:', syncErr);
          }
          await loadPendingItems({ sanitize: true });
        }

        if (pendingItems.value.length === 0) {
          await ImageService.purgeOfflineImages();
        } else {
          console.warn('[AreaCreate] Còn báo cáo chờ sync — giữ file ảnh offline');
        }

        const deleteQueue = (await storageService.get('offline_delete_queue')) || [];
        const wrongScanQueue = (await storageService.get('offline_wrong_scan_queue')) || [];
        const totalUnsynced =
          pendingItems.value.length + deleteQueue.length + wrongScanQueue.length;

        void speakImportantText(
          totalUnsynced !== 0
            ? 'Ca trực đã hoàn thành nhưng còn dữ liệu chờ đồng bộ. Vui lòng giữ máy online đến khi đồng bộ xong rồi đăng xuất.'
            : 'Ca trực đã hoàn thành, vui lòng đăng xuất để cho bảo vệ tiếp theo bắt đầu ca trực mới'
        );

        if (totalUnsynced === 0) {
          // Online sạch ngay / hoặc syncData đã mở modal (awaiting đã clear → no-op)
          await tryPromptLogoutAfterOfflineSync({
            pendingCount: 0,
            speakSuccess: false,
          });
        }
        // Còn pending: giữ awaitingLogoutAfterSync — chip sync + TTS; sync sạch sau sẽ speak + modal
      })();
    } else {
      await storageService.set('list_route', updatedRoutes);
      hideLoading();
      void finishNavigate();
      if (isDeviceOnline) {
        void syncData({ mode: 'silent' });
      }
    }

  } catch (error: any) {
    hideLoading();
    console.error("Lỗi:", error);
    const errMsg = error?.message || '';
    if (errMsg === 'MISSING_CHECKIN_GROUP' || errMsg === 'EMPTY_NOTE_GROUPS') {
      mandatoryPhoto.value = null;
      await showToast(t('areas.report.message.13'), 'danger');
    } else if (errMsg === 'IMAGE_FILE_MISMATCH') {
      await showToast(t('areas.report.message.14'), 'danger');
    } else {
      await showToast(t('areas.report.message.6'), 'danger');
    }
  } finally {
    isSubmitting.value = false;
  }
};

// const handleGoBack = async () => {
//   const details = currentActiveRoute.value?.routeDetails || [];
//   const isFinished = details.every((p: RouteDetail) => p.rdIsComplete);
//   if (isFinished || details.length === 0) return router.replace('/route');

//   const alert = await alertController.create({
//     header: t('areas.report.message.7'),
//     message: t('areas.report.message.8'),
//     buttons: [t('areas.report.message.9')]
//   });
//   await alert.present();
// };

// --- Utils ---
const getCheckpointName = (cpId: string) => {
  const cp = currentActiveRoute.value?.routeDetails.find(d => String(d.cpId) === String(cpId));
  return cp ? cp.cpName : 'Điểm quét';
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

/** Xóa file draft check-in cũ (chỉ file offline_img_*) — không ảnh hưởng queue sync */
const deleteMandatoryDraftFile = async (fileName?: string | null) => {
  if (!fileName || !fileName.startsWith('offline_img_')) return;
  await ImageService.deleteImage(fileName).catch(() => { });
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

// Hàm vẽ Watermark (ngày giờ) lên ảnh
const addWatermarkToImage = async (imageSrc: string, text: string, textColor: string = '#FFD700'): Promise<Blob | null> => {
  try {
    const blob = await previewToBlob(imageSrc);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let source: CanvasImageSource;
    let width = 0;
    let height = 0;

    if (typeof createImageBitmap !== 'undefined') {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
    } else {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = base64Data;
      });

      source = img;
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
    }

    const maxWidth = 1024;
    let drawW = width;
    let drawH = height;
    if (width > maxWidth) {
      drawW = maxWidth;
      drawH = Math.round(height * (maxWidth / width));
    }

    canvas.width = drawW;
    canvas.height = drawH;
    ctx.drawImage(source, 0, 0, drawW, drawH);

    if (source instanceof ImageBitmap) {
      source.close();
    }

    const baseFontSize = Math.max(Math.floor(drawH * 0.04), 18);
    const minFontSize = 14;
    let fontSize = baseFontSize;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const padding = Math.max(Math.floor(drawW * 0.03), 16);
    const x = padding;
    const y = padding;

    const maxTextWidth = Math.max(drawW - (padding * 2) - 20, 80);
    let metrics = ctx.measureText(text);
    while (metrics.width > maxTextWidth && fontSize > minFontSize) {
      fontSize -= 1;
      ctx.font = `bold ${fontSize}px sans-serif`;
      metrics = ctx.measureText(text);
    }
    const textWidth = metrics.width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 10, y - 10, textWidth + 20, fontSize + 20);

    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((output) => resolve(output), 'image/jpeg', 0.8);
    });
  } catch (error) {
    console.error('Watermark generation error:', error);
    return null;
  }
};

// Hàm chụp ảnh bắt buộc
const resolveGpsForCheckin = async () => {
  try {
    const coordinates = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 6000,
      maximumAge: 120000,
    });
    formData.rpLat = coordinates.coords.latitude;
    formData.rpLng = coordinates.coords.longitude;
  } catch {
    formData.rpLat = 0;
    formData.rpLng = 0;
  }
};

const captureMandatoryPhoto = async () => {
  try {
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted') {
      const request = await Geolocation.requestPermissions();
      if (request.location !== 'granted') {
        await showToast(t('areas.report.message.location_permission'), 'warning');
        return;
      }
    }
  } catch (err) {
    console.error('Lỗi cấp quyền GPS:', err);
    await showToast(t('areas.report.message.gps_error'), 'warning');
    return;
  }

  const [, photo] = await Promise.all([
    resolveGpsForCheckin(),
    takePhoto(0, 'checkin_'),
  ]);

  if (photo) {
    showLoading(t('areas.report.message.10'));

    try {
      await deleteMandatoryDraftFile(mandatoryPhoto.value?.draftFileName);

      const now = new Date();
      const timeString = now.toLocaleString('vi-VN', {
        hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      let isLate = false;
      const activeRoute = currentActiveRoute.value;

      if (activeRoute && activeRoute.psHourFrom !== undefined) {
        const currentHour = now.getHours();
        if (currentHour !== activeRoute.psHourFrom) {
          isLate = true;
        }
      }

      const watermarkColor = isLate ? '#FF0000' : '#FFD700';

      if (shouldSimulateWatermarkFail()) {
        await showToast(t('areas.report.message.12'), 'danger');
        return;
      }

      const watermarkedBlob = await addWatermarkToImage(photo.preview, timeString, watermarkColor);
      if (!watermarkedBlob) {
        await showToast(t('areas.report.message.12'), 'danger');
        return;
      }

      const watermarkedDataUrl = await blobToDataUrl(watermarkedBlob);
      if (!watermarkedDataUrl.startsWith('data:image')) {
        await showToast(t('areas.report.message.12'), 'danger');
        return;
      }

      const submitBase64 = watermarkedDataUrl.includes(',')
        ? watermarkedDataUrl.split(',')[1]
        : watermarkedDataUrl;

      mandatoryPhoto.value = {
        fileName: photo.fileName,
        preview: watermarkedDataUrl,
        submitBase64,
      };

      // Lưu thêm file local cho draft để giảm payload SQLite (tránh nhét base64 lớn vào settings)
      try {
        const draftFileName = await ImageService.saveImage(submitBase64);
        mandatoryPhoto.value.draftFileName = draftFileName;
      } catch (saveErr) {
        console.warn('[AreaCreate] Không lưu được ảnh check-in draft file:', saveErr);
      }
    } finally {
      hideLoading();
    }
  }
};

// const removeMandatoryPhoto = () => {
//   mandatoryPhoto.value = null;
// };
/////////////////////////////////////////

const draftKey = computed(() => {
  const cpId = dataScanQr.value?.cpId;
  const routeId = store.state.unfinishedRouteId || store.state.routeId;
  const psId = store.state.psId;
  if (!cpId || !routeId || !psId) return null;
  return `draft_report_${routeId}_${psId}_${cpId}`;
});

let draftTimeout: any = null;
let createPageGen = 0;

const hasDraftContent = () =>
  !!(
    formData.prHasProblem ||
    formData.prNote ||
    groupedNotes.value.length ||
    selectedValues.value.length ||
    noProblemImages.value.length ||
    mandatoryPhoto.value
  );

const persistDraftNow = async () => {
  if (draftTimeout) {
    clearTimeout(draftTimeout);
    draftTimeout = null;
  }
  if (!draftKey.value || !isReady.value || isResetting.value) return;
  if (!hasDraftContent()) return;

  await storageService.set(draftKey.value, {
    prHasProblem: formData.prHasProblem,
    prNote: formData.prNote,
    rpLat: formData.rpLat,
    rpLng: formData.rpLng,
    groupedNotes: JSON.parse(JSON.stringify(groupedNotes.value)),
    selectedValues: JSON.parse(JSON.stringify(selectedValues.value)),
    noProblemImages: JSON.parse(JSON.stringify(noProblemImages.value)),
    mandatoryPhoto: mandatoryPhoto.value
      ? {
        fileName: mandatoryPhoto.value.fileName,
        draftFileName: mandatoryPhoto.value.draftFileName || null,
      }
      : null,
  });
};

const waitUntilDraftReady = async (maxMs = 3000) => {
  const started = Date.now();
  while ((!draftKey.value || !isReady.value) && Date.now() - started < maxMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return !!(draftKey.value && isReady.value);
};

const resetCreateForm = () => {
  formData.prHasProblem = false;
  formData.prNote = '';
  groupedNotes.value = [];
  selectedValues.value = [];
  noProblemImages.value = [];
  mandatoryPhoto.value = null;
  selectedSubCategory.value = null;
  openCategoryModal.value = false;
  openDetailModal.value = false;
  openNoteModal.value = false;
};

watch([formData, groupedNotes, selectedValues, noProblemImages, mandatoryPhoto], () => {
  if (isResetting.value) return;

  if (draftTimeout) clearTimeout(draftTimeout);

  draftTimeout = setTimeout(() => {
    void persistDraftNow();
  }, 500);
}, { deep: true });

const loadDraft = async () => {
  if (!draftKey.value) return false;

  let draft: any = await storageService.get(draftKey.value);

  // Tương thích nháp cũ (chỉ key theo cpId)
  if (!draft && dataScanQr.value?.cpId) {
    draft = await storageService.get(`draft_report_${dataScanQr.value.cpId}`);
  }

  if (draft) {
    formData.prHasProblem = draft.prHasProblem || false;
    formData.prNote = draft.prNote || '';
    formData.rpLat = draft.rpLat || null;
    formData.rpLng = draft.rpLng || null;
    groupedNotes.value = draft.groupedNotes || [];
    selectedValues.value = draft.selectedValues || [];
    noProblemImages.value = draft.noProblemImages || [];
    if (draft.mandatoryPhoto) {
      const mp = draft.mandatoryPhoto;
      if (mp.draftFileName) {
        const restoredBase64 = await ImageService.readImage(mp.draftFileName);
        if (restoredBase64) {
          mandatoryPhoto.value = {
            fileName: mp.fileName || 'checkin.jpg',
            preview: `data:image/jpeg;base64,${restoredBase64}`,
            submitBase64: restoredBase64,
            draftFileName: mp.draftFileName,
          };
        } else {
          mandatoryPhoto.value = null;
        }
      } else if (mp.submitBase64) {
        mandatoryPhoto.value = {
          fileName: mp.fileName || 'checkin.jpg',
          preview: `data:image/jpeg;base64,${mp.submitBase64}`,
          submitBase64: mp.submitBase64,
        };
      } else if (mp.preview) {
        mandatoryPhoto.value = mp;
      } else {
        mandatoryPhoto.value = null;
      }
    } else {
      mandatoryPhoto.value = null;
    }
    return true;
  }
  return false;
};

const redirectIfInvalidSession = async (): Promise<boolean> => {
  if (store.getters.isPatrolSessionValid) return true;
  await showToast(t('areas.report.message.1'), 'warning');
  router.replace('/route');
  return false;
};

// --- Lifecycle ---
onActivated(async () => {
  const gen = ++createPageGen;
  if (!(await redirectIfInvalidSession())) return;
  if (gen !== createPageGen) return;

  void loadPendingItems();

  const ready = await waitUntilDraftReady();
  if (gen !== createPageGen) return;
  if (!ready) return;

  isResetting.value = true;
  const hasDraft = await loadDraft();
  if (gen !== createPageGen) return;
  if (!hasDraft) {
    resetCreateForm();
  }
  isResetting.value = false;
});

onDeactivated(async () => {
  createPageGen += 1;
  await persistDraftNow();
  isResetting.value = true;
  resetCreateForm();
});

onMounted(async () => {
  installImageDebugConsole();

  if (!store.state.isHydrated) await store.dispatch('initApp');

  const routeId = route.query.routeId || store.state.routeId;
  const psIdFromQuery = route.query.psId;

  if (psIdFromQuery) {
    store.commit('SET_PSID', Number(psIdFromQuery));
  }

  if (routeId) {
    store.commit('SET_UNFINISHED_ROUTE_ID', Number(routeId));
  }

  if (!(await redirectIfInvalidSession())) return;

  const catData = store.state.dataReportNoteCategory;
  if (catData) {
    const rawArray = Array.isArray(catData) ? catData : (catData.data || []);
    apiCategories.value = markRaw(rawArray);
  }

  // Hiện UI ngay — queue offline load nền, không chặn form report
  isReady.value = true;
  void loadPendingItems();
});

// Chặn nút back vật lý để không rời màn report ngoài ý muốn.
useHardwareBackButton(10000, () => { });
</script>

<style scoped>
.area-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.area-header {
  min-height: 48px;
  padding: 8px 8px 8px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.area-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.3;
}

.area-content {
  display: flex;
  flex-direction: column;
}

.area-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.area-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  -webkit-filter: blur(40px);
  opacity: 0.9;
}

.area-blob-green {
  width: 200px;
  height: 200px;
  background: #e3f7ac;
  top: 25%;
  right: -50px;
}

.area-blob-purple {
  width: 270px;
  height: 270px;
  background: #cac2e9;
  bottom: 5%;
  left: 5px;
}

.area-body {
  position: relative;
  z-index: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 49px;
}

.area-card {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  background: #ffffff;
}

.area-card :deep(.p-card-body) {
  padding: 14px;
}

.area-card-checkin :deep(.p-card-body) {
  text-align: center;
}

.section-label {
  margin: 0 0 12px;
  font-size: 0.95rem;
  font-weight: 500;
  color: #334155;
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
}

.field-block {
  margin-bottom: 20px;
}

.field-block :deep(.p-floatlabel) {
  width: 100%;
}

.note-textarea {
  width: 100%;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}

.checkbox-label {
  font-size: 0.95rem;
  color: #334155;
  cursor: pointer;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.image-container {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f5f9;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 1.6rem;
  height: 1.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.85);
  color: #ffffff;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
}

.btn-status,
.btn-submit,
.btn-camera {
  min-height: 3rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 12px;
}

.btn-submit {
  margin-top: 20px;
}

.checkin-prompt {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkin-require {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #475569;
}

.checkin-confirmed {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.accept-img {
  color: #16a34a;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  font-size: 0.95rem;
}

.accept-img i {
  font-size: 1.1rem;
}

.mandatory-img-container {
  width: 100%;
  min-height: 220px;
  max-height: 55vh;
  background-color: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 10px;
}

.mandatory-preview-img {
  max-width: 100%;
  max-height: 55vh;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.require {
  color: #dc2626;
}

.submit-dialog-message {
  margin: 0;
  color: #475569;
  font-size: 0.95rem;
  line-height: 1.5;
}

.submit-confirm-dialog :deep(.p-dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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