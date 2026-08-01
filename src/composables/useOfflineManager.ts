import { ref, computed } from 'vue';
import storage from '@/services/storage.service';
import { ImageService } from '@/services/image.service';
import { base64ToBlob } from '@/utils/imagePayload';
import PointReport from '@/api/PointReport';
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

    for (const fileName of item.imageFiles) {
      const base64 = await ImageService.readImage(fileName);
      if (!base64) return false;
    }
    return true;
  };

  /** Dọn mục zombie: metadata còn nhưng file ảnh mất hoặc payload không hợp lệ */
  const sanitizeQueue = async (): Promise<number> => {
    const queue: PendingItem[] = (await storage.get('offline_api_queue')) || [];
    const kept: PendingItem[] = [];
    let removed = 0;

    for (const item of queue) {
      const readable = await hasReadableImageFiles(item);
      if (!isQueueItemValid(item) || !readable) {
        console.warn(`[Offline] Item ${item.id} không hợp lệ hoặc thiếu ảnh — xóa khỏi hàng chờ`);
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
        console.warn(`[Offline] Dọn mục ca cũ ${item.id} (psId ${item.data?.psId}) — thiếu ảnh hoặc không hợp lệ`);
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
    imagesBase64?: string[]
  ): Promise<FormData> => {
    const fb = new FormData();
    const expectedImages = countExpectedImages(item.data);
    let attachedImages = 0;
    const useMemory = Array.isArray(imagesBase64) && imagesBase64.length > 0;

    // 1. Append các trường phẳng (Primitive)
    fb.append('psId', item.data.psId.toString());
    fb.append('routeId', item.data.routeId.toString());
    fb.append('rdId', item.data.rdId.toString());
    fb.append('prHasProblem', item.data.prHasProblem ? 'true' : 'false');
    fb.append('prNote', item.data.prNote || '');
    fb.append('createdAt', item.data.createdAt);
    fb.append('createdBy', item.data.createdBy);
    fb.append('scanAt', item.data.scanAt || item.data.createdAt);

    if (item.data.rpLat !== null && item.data.rpLat !== undefined) {
      fb.append('rpLat', item.data.rpLat.toString());
    }
    if (item.data.rpLng !== null && item.data.rpLng !== undefined) {
      fb.append('rpLng', item.data.rpLng.toString());
    }

    // 2. Xử lý noteGroups theo chuẩn Index lồng nhau
    if (item.data.noteGroups && Array.isArray(item.data.noteGroups)) {
      let globalImageIndex = 0;

      for (let i = 0; i < item.data.noteGroups.length; i++) {
        const group = item.data.noteGroups[i];

        fb.append(`noteGroups[${i}].prGroup`, group.prGroup.toString());
        fb.append(`noteGroups[${i}].priImageNote`, group.priImageNote || '');
        if (group.rncId !== null && group.rncId !== undefined && group.rncId !== '' && Number(group.rncId) > 0) {
          fb.append(`noteGroups[${i}].rncId`, group.rncId.toString());
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
              } else {
                console.error(`Thiếu file ảnh tại index ${globalImageIndex}`);
              }
            }

            if (base64) {
              const blob = base64ToBlob(base64, mimeType);
              fb.append(`noteGroups[${i}].reportImages`, blob, `group${i}_img${j}.${ext}`);
              if (imgMeta?.priImageType) {
                fb.append(`noteGroups[${i}].reportImages[${j}].priImageType`, imgMeta.priImageType);
              }
              attachedImages++;
            } else {
              console.error(`Không lấy được ảnh tại index ${globalImageIndex}`);
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

  const persistImagesToDisk = async (imagesBase64: string[]): Promise<string[]> => {
    const imageFiles: string[] = [];
    for (const base64 of imagesBase64) {
      try {
        const fileName = await ImageService.saveImage(base64);
        imageFiles.push(fileName);
      } catch (err) {
        console.error('Lỗi lưu ảnh vật lý:', err);
        for (const fileName of imageFiles) {
          await ImageService.deleteImage(fileName).catch(() => { });
        }
        throw new Error('IMAGE_FILE_MISMATCH');
      }
    }
    return imageFiles;
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

  const reloadQueueFromStorage = async (): Promise<void> => {
    const queue: PendingItem[] = (await storage.get('offline_api_queue')) || [];
    pendingItems.value = queue;
  };

  const loadPendingItems = async (options: { sanitize?: boolean } = {}): Promise<void> => {
    if (options.sanitize) {
      await sanitizeQueue();
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

  const addToQueue = async (item: PendingItem): Promise<void> => {
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

    presentToast(t('messages.use-offline.saved-to-queue'));
    storeInstance.commit('ADD_OFFLINE_REPORT', mockReport);
  };

  const sendData = async (url: string, data: any, imagesBase64: string[] = []): Promise<void> => {
    const id = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    const expectedImageCount = countExpectedImages(data);

    if (!Array.isArray(data?.noteGroups) || data.noteGroups.length === 0 || expectedImageCount === 0) {
      console.error('[sendData] noteGroups rỗng hoặc không có ảnh — từ chối gửi');
      throw new Error('EMPTY_NOTE_GROUPS');
    }

    if (!hasValidCheckinNoteGroup(data)) {
      console.error('[sendData] thiếu nhóm check-in prGroup: 1 — từ chối gửi');
      throw new Error('MISSING_CHECKIN_GROUP');
    }

    if (expectedImageCount > 0 && imagesBase64.length !== expectedImageCount) {
      console.error(`Số base64 (${imagesBase64.length}) không khớp metadata (${expectedImageCount})`);
      throw new Error('IMAGE_FILE_MISMATCH');
    }

    const enqueueWithImages = async () => {
      const imageFiles = await persistImagesToDisk(imagesBase64);
      await addToQueue({ id, url, data, imageFiles });
    };

    // Online: FormData từ RAM → API; chỉ ghi disk khi fallback queue
    if (storeInstance.state.isOnline) {
      try {
        const memoryItem: PendingItem = { id, url, data, imageFiles: [] };
        const bodyFormData = await buildFormData(memoryItem, imagesBase64);

        const result = await PointReport.createPointReport(bodyFormData);
        const responseData = result?.data || result;

        if (responseData && responseData.success === false) {
          const msg = (responseData.message || '').toLowerCase();

          if (responseData.statusCode === 401 || responseData.code === 401 || msg.includes('unauthorized') || msg.includes('token')) {
            storeInstance.commit('SET_TOKEN', null);
            await storage.remove('user_token');
            router.replace('/login');
            return;
          }

          if (msg.includes('đã tồn tại')) {
            console.warn(`[Send] Báo cáo ${data.cpId} đã tồn tại trên Server.`);
            return;
          }

          throw { isCustom: true, status: 500, message: responseData.message };
        }

        const realReport = responseData?.data || responseData;
        if (realReport && realReport !== false) {
          storeInstance.commit('ADD_OFFLINE_REPORT', realReport);
        }
      } catch (error) {
        console.warn('Gửi trực tiếp thất bại, chuyển vào hàng chờ...', error);
        await enqueueWithImages();
      }
    } else {
      await enqueueWithImages();
    }
  };

  const syncData = async (): Promise<void> => {
    // Chặn nếu đang xử lý hoặc offline
    if (isProcessing || storeInstance.state.isSyncingOffline || !storeInstance.state.isOnline) return;

    isProcessing = true;
    storeInstance.commit('SET_SYNC_OFFLINE_STATUS', true);
    isSyncing.value = true;

    storeInstance.commit('SET_SYNC_STATUS', {
      progress: 0,
      message: t('messages.use-offline.syncing'),
      isSyncing: true,
      mode: 'overlay'
    });

    const watchdogTimer = setTimeout(() => {
      if (isProcessing) {
        console.warn("Hết thời gian chờ đồng bộ (Timeout). Buộc tắt Overlay!");

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
    }, 30000);

    console.log("--- [START] BẮT ĐẦU ĐỒNG BỘ ---");

    let removedInvalidCount = 0;

    try {
      // 1. Xử lý hàng chờ xóa
      let deleteQueue = (await storage.get('offline_delete_queue')) || [];
      if (deleteQueue.length > 0) {
        storeInstance.commit('SET_SYNC_STATUS', {
          progress: 0,
          message: t('messages.use-offline.cleaning'),
          isSyncing: true,
          mode: 'overlay'
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
          console.log("Đã đồng bộ và dọn dẹp Log quét sai thành công!");
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
        if (!storeInstance.state.isOnline) break;

        processedItems++;
        const percent = Math.round((processedItems / totalItems) * 100);
        storeInstance.commit('SET_SYNC_STATUS', {
          progress: percent,
          message: t('messages.use-offline.uploading', { processedItems, totalItems }),
          isSyncing: true,
          mode: 'overlay'
        });

        if (!isQueueItemValid(item)) {
          console.error(`[Sync] Item ${item.id} không hợp lệ — dọn khỏi hàng chờ`);
          await cleanUpItem(item);
          removedInvalidCount++;
          continue;
        }

        const imagesReadable = await hasReadableImageFiles(item);
        if (!imagesReadable) {
          console.error(`[Sync] Item ${item.id} thiếu file ảnh — dọn khỏi hàng chờ`);
          await cleanUpItem(item);
          removedInvalidCount++;
          continue;
        }

        // Đọc ảnh từ file vật lý để gán lại vào payload
        if (item.imageFiles && item.imageFiles.length > 0) {
          let fileIndex = 0;
          if (item.data.noteGroups) {
            for (const group of item.data.noteGroups) {
              for (const imgObj of group.reportImages) {
                const base64Clean = await ImageService.readImage(item.imageFiles[fileIndex]);
                if (base64Clean) {
                  imgObj.priImage = base64Clean;
                }
                fileIndex++;
              }
            }
          }
        }

        try {
          const bodyFormData = await buildFormData(item);
          const result = await PointReport.createPointReport(bodyFormData);

          const responseData = result?.data || result;

          // === BẮT LỖI SOFT ERROR TỪ BACKEND ===
          if (responseData && responseData.success === false) {

            const msg = (responseData.message || '').toLowerCase();

            if (responseData.statusCode === 401 || responseData.code === 401 || msg.includes('unauthorized') || msg.includes('token')) {
              console.warn("Phát hiện Token hết hạn trong Soft Error. Ép văng ra Login!");

              storeInstance.commit('SET_TOKEN', null);
              await storage.remove('user_token');
              router.replace('/login');
              return;
            }

            if (msg.includes('đã tồn tại')) {
              console.warn(`[Sync] Báo cáo ${item.data.cpId} đã tồn tại trên Server. Xóa khỏi hàng chờ.`);
              await cleanUpItem(item);
              continue;
            }
            else {
              // Ném các lỗi khác xuống catch để dừng Sync và báo Toast
              throw { isCustom: true, status: 500, message: responseData.message };
            }
          }
          // ==========================================

          const realReport = responseData?.data || responseData;

          await cleanUpItem(item);

          if (realReport && realReport !== false) {
            storeInstance.commit('ADD_OFFLINE_REPORT', realReport);
          }

        } catch (error: any) {
          const errMsg = error?.message || '';

          if (errMsg === 'FORM_DATA_IMAGE_MISMATCH') {
            console.error(`[Sync] Item ${item.id} thiếu file ảnh — dọn khỏi hàng chờ`);
            await cleanUpItem(item);
            removedInvalidCount++;
            continue;
          }

          const statusCode = error.isCustom ? error.status : (error.response?.status || error.status);

          if ([400, 409, 422].includes(statusCode)) {
            await cleanUpItem(item);
          } else {
            console.error("Lỗi mạng/Server, dừng tiến trình Sync.");
            if (statusCode >= 500) {
              presentToast(t('messages.use-offline.maintenance'), 'danger');
            }
            break;
          }
        }
      }
    } catch (e) {
      console.error("Lỗi tổng quát Sync:", e);
    } finally {
      clearTimeout(watchdogTimer);

      await loadPendingItems({ sanitize: true });

      const remainingCount = pendingItems.value.length;

      // Delay nhỏ để UI mượt mà hơn trước khi tắt trạng thái Syncing
      if (isProcessing) {
        setTimeout(async () => {
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
          } else {
            storeInstance.commit('SET_SYNC_STATUS', {
              progress: 0,
              message: t('messages.use-offline.incomplete', { count: remainingCount }),
              isSyncing: false,
              mode: 'silent'
            });
            presentToast(t('messages.use-offline.incomplete', { count: remainingCount }), 'warning');

            if (removedInvalidCount > 0) {
              presentToast(
                t('messages.use-offline.removed-invalid', { count: removedInvalidCount }),
                'danger'
              );
            }
          }

          console.log("--- [END] KẾT THÚC ĐỒNG BỘ ---");
        }, 800);
      }
    }
  };

  return {
    isOnline: computed(() => storeInstance.state.isOnline),
    isSyncing: computed(() => storeInstance.state.isSyncingOffline || isSyncing.value),
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