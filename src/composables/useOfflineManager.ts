import { ref, computed } from 'vue';
import storage from '@/services/storage.service';
import { ImageService } from '@/services/image.service';
import { base64ToBlob } from '@/utils/imagePayload';
import store from '@/composables/useVuex';
import { useToast } from 'primevue/usetoast';
import PatrolShift from '@/api/PatrolShift';
import Sync from '@/api/Sync';
import { useI18n } from 'vue-i18n';
import router from '@/router';

// Các biến trạng thái dùng chung giữa các instance của composable
const pendingItems = ref<PendingItem[]>([]);
const isSyncing = ref(false);
let isProcessing = false; // Khóa ngăn chặn gọi syncData song song
/** Số lượng sendData/enqueue đang chạy — dùng chặn logout & clear queue sớm */
const activeSendDataCount = ref(0);

export function isSendDataInFlight(): boolean {
  return activeSendDataCount.value > 0;
}

export const isSendDataBusy = computed(() => activeSendDataCount.value > 0);

export async function waitForSendDataIdle(maxMs = 60000): Promise<boolean> {
  const start = Date.now();
  while (activeSendDataCount.value > 0 && Date.now() - start < maxMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return activeSendDataCount.value === 0;
}
const HIGH_QUEUE_THRESHOLD = 30;
const AVG_IMAGE_SIZE_MB = 0.35;
const HIGH_QUEUE_ESTIMATED_MB = 120;
let hasShownHighQueueWarning = false;

interface PendingItem {
  id: string | number;
  url: string;
  data: any;
  imageFiles: string[];
}

export function useOfflineManager() {
  const storeInstance = store;
  const { t } = useI18n();
  const toast = useToast();

  const countExpectedImages = (data: any): number => {
    if (!data?.noteGroups || !Array.isArray(data.noteGroups)) return 0;
    return data.noteGroups.reduce(
      (sum: number, group: any) => sum + (group.reportImages?.length || 0),
      0
    );
  };

  const hasValidCheckinNoteGroup = (data: any): boolean => {
    if (!Array.isArray(data?.noteGroups)) return false;
    const checkinGroup = data.noteGroups.find((g: any) => Number(g.prGroup) === 1);
    return !!(checkinGroup?.reportImages?.length);
  };

  const isQueueItemValid = (item: PendingItem): boolean => {
    const queueExpectedImages = countExpectedImages(item.data);
    return (
      Array.isArray(item.data?.noteGroups) &&
      item.data.noteGroups.length > 0 &&
      queueExpectedImages > 0 &&
      (item.imageFiles?.length ?? 0) === queueExpectedImages &&
      hasValidCheckinNoteGroup(item.data)
    );
  };

  const hasReadableImageFiles = async (item: PendingItem): Promise<boolean> => {
    const expectedImages = countExpectedImages(item.data);
    if (expectedImages === 0) return false;
    if (!item.imageFiles?.length) return false;
    if (item.imageFiles.length !== expectedImages) return false;

    const checks = await Promise.all(
      item.imageFiles.map((fileName) => ImageService.imageExists(fileName))
    );
    return checks.every(Boolean);
  };

  /** Dọn mục zombie: metadata còn nhưng file ảnh mất hoặc payload không hợp lệ */
  const sanitizeQueue = async (): Promise<number> => {
    const queue: PendingItem[] = (await storage.get('offline_api_queue')) || [];
    const kept: PendingItem[] = [];
    let removed = 0;

    for (const item of queue) {
      const readable = await hasReadableImageFiles(item);
      if (!isQueueItemValid(item) || !readable) {
        for (const fileName of item.imageFiles || []) {
          await ImageService.deleteImage(fileName).catch(() => { });
        }
        storeInstance.commit('REMOVE_OFFLINE_REPORT', item.id);
        removed++;
      } else {
        kept.push(item);
      }
    }

    if (removed > 0) {
      await storage.set('offline_api_queue', kept);
    }
    pendingItems.value = kept;
    return removed;
  };

  /** Khi chuyển ca: dọn mục orphan thuộc ca cũ; giữ mục ca cũ còn ảnh hợp lệ để sync nền */
  const purgeStaleShiftQueue = async (currentPsId: number | string | null | undefined): Promise<number> => {
    if (currentPsId == null || currentPsId === '') return 0;

    const queue: PendingItem[] = (await storage.get('offline_api_queue')) || [];
    const kept: PendingItem[] = [];
    let removed = 0;

    for (const item of queue) {
      const isCurrentShift = Number(item.data?.psId) === Number(currentPsId);
      if (isCurrentShift) {
        kept.push(item);
        continue;
      }

      const readable = await hasReadableImageFiles(item);
      if (!readable || !isQueueItemValid(item)) {
        for (const fileName of item.imageFiles || []) {
          await ImageService.deleteImage(fileName).catch(() => { });
        }
        storeInstance.commit('REMOVE_OFFLINE_REPORT', item.id);
        removed++;
      } else {
        kept.push(item);
      }
    }

    if (removed > 0) {
      await storage.set('offline_api_queue', kept);
      pendingItems.value = kept;
    }
    return removed;
  };

  const buildFormData = async (
    item: PendingItem,
    imagesBase64?: string[],
    listKey?: string,
    itemIndex = 0
  ): Promise<FormData> => {
    const fb = new FormData();
    const prefix = listKey ? `${listKey}[${itemIndex}].` : '';
    const expectedImages = countExpectedImages(item.data);
    let attachedImages = 0;
    const useMemory = Array.isArray(imagesBase64) && imagesBase64.length > 0;

    fb.append(`${prefix}psId`, item.data.psId.toString());
    fb.append(`${prefix}routeId`, item.data.routeId.toString());
    fb.append(`${prefix}rdId`, item.data.rdId.toString());
    fb.append(`${prefix}prHasProblem`, item.data.prHasProblem ? 'true' : 'false');
    fb.append(`${prefix}prNote`, item.data.prNote || '');
    fb.append(`${prefix}createdAt`, item.data.createdAt);
    fb.append(`${prefix}createdBy`, item.data.createdBy);
    fb.append(`${prefix}scanAt`, item.data.scanAt || item.data.createdAt);

    if (item.data.rpLat !== null && item.data.rpLat !== undefined) {
      fb.append(`${prefix}rpLat`, item.data.rpLat.toString());
    }
    if (item.data.rpLng !== null && item.data.rpLng !== undefined) {
      fb.append(`${prefix}rpLng`, item.data.rpLng.toString());
    }

    if (item.data.noteGroups && Array.isArray(item.data.noteGroups)) {
      let globalImageIndex = 0;

      for (let i = 0; i < item.data.noteGroups.length; i++) {
        const group = item.data.noteGroups[i];

        fb.append(`${prefix}noteGroups[${i}].prGroup`, group.prGroup.toString());
        fb.append(`${prefix}noteGroups[${i}].priImageNote`, group.priImageNote || '');
        if (group.rncId !== null && group.rncId !== undefined && group.rncId !== '' && Number(group.rncId) > 0) {
          fb.append(`${prefix}noteGroups[${i}].rncId`, group.rncId.toString());
        }

        if (group.reportImages && group.reportImages.length > 0) {
          for (let j = 0; j < group.reportImages.length; j++) {
            const imgMeta = group.reportImages[j];
            const imageType = (imgMeta?.priImageType || 'jpg').replace(/^\./, '');
            const mimeType = imageType === 'jpg' || imageType === 'jpeg' ? 'image/jpeg' : `image/${imageType}`;
            const ext = imageType === 'jpeg' ? 'jpg' : imageType;

            let base64: string | null = null;
            if (useMemory) {
              base64 = imagesBase64![globalImageIndex] || null;
            } else {
              const fileName = item.imageFiles[globalImageIndex];
              if (fileName) {
                base64 = await ImageService.readImage(fileName);
              }
            }

            if (base64) {
              const blob = base64ToBlob(base64, mimeType);
              fb.append(`${prefix}noteGroups[${i}].reportImages`, blob, `group${i}_img${j}.${ext}`);
              if (imgMeta?.priImageType) {
                fb.append(`${prefix}noteGroups[${i}].reportImages[${j}].priImageType`, imgMeta.priImageType);
              }
              attachedImages++;
            }
            globalImageIndex++;
          }
        }
      }
    }

    if (expectedImages > 0 && attachedImages !== expectedImages) {
      throw new Error('FORM_DATA_IMAGE_MISMATCH');
    }

    return fb;
  };

  const isUnauthorizedPayload = (payload: any): boolean => {
    const msg = (payload?.message || '').toLowerCase();
    return payload?.statusCode === 401 || payload?.code === 401 || msg.includes('unauthorized') || msg.includes('token');
  };

  const isDuplicatePayload = (payload: any): boolean =>
    (payload?.message || '').toLowerCase().includes('đã tồn tại');

  const pickCreatedReport = (entry: any): any | null => {
    if (!entry || entry === false) return null;
    const nested = entry.data;
    if (nested && typeof nested === 'object' && !Array.isArray(nested) && (nested.prId || nested.cpId || nested.psId)) {
      return nested;
    }
    if (entry.prId || entry.cpId || entry.psId) return entry;
    return null;
  };

  type PointReportEvalStatus = 'success' | 'duplicate' | 'unauthorized' | 'failed';

  /** Chỉ coi thành công khi success === true (hoặc trùng "đã tồn tại") */
  const evaluatePointReportResponse = (payload: any): {
    status: PointReportEvalStatus;
    message?: string;
    report?: any;
  } => {
    if (!payload || typeof payload !== 'object') {
      return { status: 'failed', message: 'Phản hồi server không hợp lệ' };
    }

    if (isUnauthorizedPayload(payload)) {
      return { status: 'unauthorized', message: payload.message };
    }

    if (isDuplicatePayload(payload)) {
      return { status: 'duplicate', message: payload.message };
    }

    if (payload.success === true) {
      const report = pickCreatedReport(payload);
      return {
        status: 'success',
        message: payload.message,
        report: report ?? (payload.data !== undefined ? payload.data : null),
      };
    }

    return {
      status: 'failed',
      message: payload.message || 'Server từ chối lưu báo cáo',
    };
  };

  const applySuccessfulPointReport = (evalResult: { report?: any }) => {
    const report = evalResult.report;
    if (report && report !== true && report !== false) {
      storeInstance.commit('ADD_OFFLINE_REPORT', report);
    }
  };

  const listifyPointReportResults = (envelope: any): any[] => {
    if (!envelope) return [];
    const inner = envelope.data !== undefined ? envelope.data : envelope;
    if (Array.isArray(inner)) return inner;
    if (inner && Array.isArray(inner.results)) return inner.results;
    if (inner === false || inner == null) return [];
    return [inner];
  };

  const forceLogoutOnExpiredToken = async () => {
    storeInstance.commit('SET_TOKEN', null);
    await storage.remove('user_token');
    router.replace('/login');
  };

  const persistImagesToDisk = async (
    imagesBase64: string[],
    existingImageFiles: Array<string | null | undefined> = []
  ): Promise<string[]> => {
    const results = await Promise.all(imagesBase64.map(async (base64, index) => {
      try {
        const existing = existingImageFiles[index];
        if (typeof existing === 'string' && existing.startsWith('offline_img_')) {
          const exists = await ImageService.imageExists(existing);
          if (exists) {
            return { fileName: existing, created: false as const };
          }
        }
        const fileName = await ImageService.saveImage(base64);
        return { fileName, created: true as const };
      } catch (err) {
        console.error('Lỗi lưu ảnh vật lý:', err);
        return { error: true as const };
      }
    }));

    const created = results
      .filter((r): r is { fileName: string; created: true } => 'created' in r && r.created === true)
      .map((r) => r.fileName);

    if (results.some((r) => 'error' in r || !('fileName' in r) || !r.fileName)) {
      await Promise.all(created.map((fileName) => ImageService.deleteImage(fileName).catch(() => { })));
      throw new Error('IMAGE_FILE_MISMATCH');
    }

    return results.map((r) => (r as { fileName: string }).fileName);
  };

  const presentToast = (message: string, color: string = 'warning') => {
    const severity = color === 'danger'
      ? 'error'
      : color === 'success'
        ? 'success'
        : color === 'warning'
          ? 'warn'
          : 'info';

    toast.add({
      severity,
      summary: message,
      life: 6000,
      closable: false,
    });
  };

  const maybeWarnLargeQueue = (count: number) => {
    const totalImages = pendingItems.value.reduce(
      (sum, item) => sum + (item.imageFiles?.length || 0),
      0
    );
    const estimatedMb = totalImages * AVG_IMAGE_SIZE_MB;
    const shouldWarn = count >= HIGH_QUEUE_THRESHOLD || estimatedMb >= HIGH_QUEUE_ESTIMATED_MB;

    if (shouldWarn) {
      if (hasShownHighQueueWarning) return;
      hasShownHighQueueWarning = true;
      presentToast(
        `Thiết bị đang có ${count} báo cáo chờ đồng bộ (ước tính ~${estimatedMb.toFixed(1)}MB ảnh). Vui lòng đồng bộ sớm để tránh máy chậm.`,
        'warning'
      );
      return;
    }
    hasShownHighQueueWarning = false;
  };

  const reloadQueueFromStorage = async (): Promise<void> => {
    const queue: PendingItem[] = (await storage.get('offline_api_queue')) || [];
    pendingItems.value = queue;
    maybeWarnLargeQueue(queue.length);
  };

  const loadPendingItems = async (options: { sanitize?: boolean } = {}): Promise<void> => {
    if (options.sanitize) {
      await sanitizeQueue();
      maybeWarnLargeQueue(pendingItems.value.length);
    } else {
      await reloadQueueFromStorage();
    }
  };

  const removeQueueItem = async (id: string | number) => {
    const currentQueue: PendingItem[] = (await storage.get('offline_api_queue')) || [];
    const updatedQueue = currentQueue.filter((q) => q.id !== id);
    await storage.set('offline_api_queue', updatedQueue);
    pendingItems.value = updatedQueue;
  };

  // Hàm dọn dẹp tập trung: Xóa Queue SQLite trước, tránh zombie khi xóa ảnh thành công mà ghi DB lỗi
  const cleanUpItem = async (item: PendingItem) => {
    const imageFiles = item.imageFiles?.length ? [...item.imageFiles] : [];

    await removeQueueItem(item.id);
    storeInstance.commit('REMOVE_OFFLINE_REPORT', item.id);

    for (const fileName of imageFiles) {
      await ImageService.deleteImage(fileName).catch(() => { });
    }
  };

  const addToQueue = async (
    item: PendingItem,
    options: { notify?: boolean } = {}
  ): Promise<void> => {
    // 1. CLONE (Tạo bản sao) để không làm ảnh hưởng data gốc đang gửi trực tiếp
    const itemToSave = JSON.parse(JSON.stringify(item));

    // 2. Xóa trắng chuỗi Base64 nặng nề trước khi lưu vào SQLite
    if (itemToSave.data?.noteGroups) {
      for (const group of itemToSave.data.noteGroups) {
        if (group.reportImages) {
          for (const img of group.reportImages) {
            img.priImage = ''; // Xóa sạch Base64, chỉ giữ lại khung data
          }
        }
      }
    }

    // 3. Lưu bản sao siêu nhẹ này vào SQLite
    const queue: PendingItem[] = (await storage.get('offline_api_queue')) || [];
    queue.push(itemToSave);
    await storage.set('offline_api_queue', queue);
    await reloadQueueFromStorage();

    const actualUser: any = storeInstance.state.dataUser;
    const userData = actualUser?.data ? actualUser.data : actualUser;

    // Tạo báo cáo ảo để hiển thị ngay trên UI
    const mockReport = {
      psId: item.data.psId,
      prId: item.id,
      routeId: item.data.routeId,
      rdId: item.data.rdId,
      cpId: item.data.cpId,
      cpName: item.data.cpName,
      createdName: userData?.fullName,
      createdAt: item.data.createdAt || new Date().toISOString(),
      prHasProblem: item.data.prHasProblem,
      prNote: item.data.prNote,
      isOfflineMock: true,
      reportImages: []
    };

    if (options.notify !== false) {
      presentToast(t('messages.use-offline.saved-to-queue'));
    }
    storeInstance.commit('ADD_OFFLINE_REPORT', mockReport);
  };

  const sendData = async (
    url: string,
    data: any,
    imagesBase64: string[] = [],
    existingImageFiles: Array<string | null | undefined> = []
  ): Promise<string[]> => {
    activeSendDataCount.value++;
    try {
      const id = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
      const expectedImageCount = countExpectedImages(data);

      if (!Array.isArray(data?.noteGroups) || data.noteGroups.length === 0 || expectedImageCount === 0) {
        throw new Error('EMPTY_NOTE_GROUPS');
      }

      if (!hasValidCheckinNoteGroup(data)) {
        throw new Error('MISSING_CHECKIN_GROUP');
      }

      if (expectedImageCount > 0 && imagesBase64.length !== expectedImageCount) {
        throw new Error('IMAGE_FILE_MISMATCH');
      }

      // Queue-first: ghi disk + SQLite xong mới trả về — mạng sync sau, không giữ RAM.
      const imageFiles = await persistImagesToDisk(imagesBase64, existingImageFiles);
      const isOnline = !!storeInstance.state.isOnline;
      await addToQueue({ id, url, data, imageFiles }, { notify: !isOnline });
      return imageFiles;
    } finally {
      activeSendDataCount.value--;
    }
  };

  const syncData = async (options?: { mode?: 'overlay' | 'silent' }): Promise<void> => {
    // Chặn nếu đang xử lý hoặc offline
    if (isProcessing || storeInstance.state.isSyncingOffline || !storeInstance.state.isOnline) return;

    const uiMode = options?.mode === 'silent' ? 'silent' : 'overlay';

    isProcessing = true;
    storeInstance.commit('SET_SYNC_OFFLINE_STATUS', true);
    isSyncing.value = true;

    storeInstance.commit('SET_SYNC_STATUS', {
      progress: 0,
      message: t('messages.use-offline.syncing'),
      isSyncing: true,
      mode: uiMode
    });

    const queueSnapshot: PendingItem[] = (await storage.get('offline_api_queue')) || [];
    const watchdogMs = Math.min(300000, 30000 + (queueSnapshot.length * 15000));
    const watchdogTimer = setTimeout(() => {
      if (isProcessing) {
        // Ép reset các cờ trạng thái
        isProcessing = false;
        storeInstance.commit('SET_SYNC_OFFLINE_STATUS', false);
        isSyncing.value = false;

        // Tắt màn hình Overlay
        storeInstance.commit('SET_SYNC_STATUS', {
          progress: 0,
          message: 'Đồng bộ gián đoạn do kết nối yếu', // Hoặc dùng biến ngôn ngữ: t('messages.use-offline.timeout')
          isSyncing: false,
          mode: 'silent'
        });

        // Báo lỗi cho user biết
        presentToast('Kết nối mạng không ổn định, vui lòng thử lại sau.', 'danger');
      }
    }, watchdogMs);

    let removedInvalidCount = 0;
    let hasShownServerErrorToast = false;

    try {
      // 1. Xử lý hàng chờ xóa
      let deleteQueue = (await storage.get('offline_delete_queue')) || [];
      if (deleteQueue.length > 0) {
        storeInstance.commit('SET_SYNC_STATUS', {
          progress: 0,
          message: t('messages.use-offline.cleaning'),
          isSyncing: true,
          mode: uiMode
        });

        // Tạo một mảng mới để chứa những cái XÓA THẤT BẠI (để lưu lại lần sau)
        const failedDeletes = [];

        for (const delItem of deleteQueue) {
          try {
            // Gọi API xóa
            await PatrolShift.postRemovePatrolShift(delItem);
          } catch (e) {
            // Nếu lỗi mạng, giữ lại trong hàng chờ
            failedDeletes.push(delItem);
          }
        }

        // Cập nhật lại Storage một lần duy nhất sau khi chạy xong vòng lặp
        await storage.set('offline_delete_queue', failedDeletes);
      }

      try {
        const wrongScanQueue = await storage.get('offline_wrong_scan_queue');

        if (Array.isArray(wrongScanQueue) && wrongScanQueue.length > 0) {
          await Sync.syncScanCpQrLog(wrongScanQueue);

          // Thành công thì dọn dẹp hàng chờ
          await storage.remove('offline_wrong_scan_queue');
        }
      } catch (err) {
        console.error("Lỗi đồng bộ mảng Log quét sai (Sẽ thử lại lần sau):", err);
      }

      // 2. Xử lý hàng chờ gửi API
      await loadPendingItems({ sanitize: true });
      const queue = [...pendingItems.value];

      const totalItems = queue.length;
      let processedItems = 0;

      if (queue.length === 0) return;

      for (const item of queue) {
        processedItems++;
        const percent = Math.round((processedItems / totalItems) * 100);
        storeInstance.commit('SET_SYNC_STATUS', {
          progress: percent,
          message: t('messages.use-offline.uploading', { processedItems, totalItems }),
          isSyncing: true,
          mode: uiMode
        });

        // Metadata nhẹ — sanitize chỉ stat file; nội dung ảnh đọc lúc buildFormData / POST
        if (!isQueueItemValid(item)) {
          await cleanUpItem(item);
          removedInvalidCount++;
          continue;
        }

        try {
          const bodyFormData = await buildFormData(item, undefined, 'dto', 0);
          const result = await Sync.syncPointReport(bodyFormData);

          const envelope = result?.data || result;
          const firstResult = listifyPointReportResults(envelope)[0] ?? envelope;
          const evalResult = evaluatePointReportResponse(
            firstResult?.success !== undefined ? firstResult : envelope
          );

          if (evalResult.status === 'unauthorized') {
            await forceLogoutOnExpiredToken();
            return;
          }

          if (evalResult.status === 'duplicate') {
            await cleanUpItem(item);
            continue;
          }

          if (evalResult.status === 'success') {
            await cleanUpItem(item);
            applySuccessfulPointReport(evalResult);
            continue;
          }

          throw {
            isCustom: true,
            status: 500,
            message: evalResult.message || firstResult?.message || envelope?.message,
            code: 'POINT_REPORT_NOT_SUCCESS',
          };

        } catch (error: any) {
          const errMsg = error?.message || '';

          if (errMsg === 'FORM_DATA_IMAGE_MISMATCH') {
            // Giữ queue — đọc file fail tạm thời không được coi là mất báo cáo
            console.warn('[useOffline] FORM_DATA_IMAGE_MISMATCH — giữ item để thử lại:', item.id);
            continue;
          }

          const statusCode = error.isCustom ? error.status : (error.response?.status || error.status);

          if (statusCode === 401 || isUnauthorizedPayload(error)) {
            await forceLogoutOnExpiredToken();
            return;
          }

          if ([400, 409, 422].includes(statusCode)) {
            await cleanUpItem(item);
            continue;
          }

          // Giữ item trong queue — gửi nốt các điểm còn lại
          if (statusCode >= 500 && !hasShownServerErrorToast) {
            hasShownServerErrorToast = true;
            presentToast(t('messages.use-offline.maintenance'), 'danger');
          }

          const isNetworkFail =
            error?.name === 'TypeError' ||
            (typeof errMsg === 'string' && errMsg.includes('Failed to fetch'));
          if (isNetworkFail) break;
          continue;
        }

        // Nhường event-loop sau mỗi item để UI mượt hơn trên máy yếu
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (e) {
      console.error("Lỗi tổng quát Sync:", e);
    } finally {
      clearTimeout(watchdogTimer);

      await loadPendingItems({ sanitize: true });

      const remainingCount = pendingItems.value.length;

      // Chờ ngắn rồi tắt overlay — await để safeSync không download chồng lên giữa chừng
      if (isProcessing) {
        await new Promise((resolve) => setTimeout(resolve, 400));

        isProcessing = false;
        storeInstance.commit('SET_SYNC_OFFLINE_STATUS', false);
        isSyncing.value = false;

        if (remainingCount === 0) {
          if (removedInvalidCount > 0) {
            storeInstance.commit('SET_SYNC_STATUS', {
              progress: 100,
              message: t('messages.use-offline.removed-invalid', { count: removedInvalidCount }),
              isSyncing: false,
              mode: 'silent'
            });
            presentToast(
              t('messages.use-offline.removed-invalid', { count: removedInvalidCount }),
              'danger'
            );
          } else {
            storeInstance.commit('SET_SYNC_STATUS', {
              progress: 100,
              message: t('messages.use-offline.completed'),
              isSyncing: false,
              mode: 'silent'
            });
          }
          // Logout prompt: để App.safeSync gọi sau khi download xong (tránh overlay đè + speak đôi)
        } else {
          storeInstance.commit('SET_SYNC_STATUS', {
            progress: 0,
            message: t('messages.use-offline.incomplete', { count: remainingCount }),
            isSyncing: false,
            mode: 'silent'
          });
          if (uiMode !== 'silent') {
            presentToast(t('messages.use-offline.incomplete', { count: remainingCount }), 'warning');
          }

          if (removedInvalidCount > 0) {
            presentToast(
              t('messages.use-offline.removed-invalid', { count: removedInvalidCount }),
              'danger'
            );
          }
        }
      }
    }
  };

  return {
    isOnline: computed(() => storeInstance.state.isOnline),
    isSyncing: computed(() => storeInstance.state.isSyncingOffline || isSyncing.value),
    isSendDataBusy,
    waitForSendDataIdle,
    pendingItems,
    sendData,
    loadPendingItems,
    syncData,
    removeQueueItem,
    purgeStaleShiftQueue,
    cleanUpItem,
    addToQueue // Trả về để có thể dùng nếu cần
  };
}