import { ref, computed } from 'vue';
import storage from '@/services/storage.service';
import { ImageService } from '@/services/image.service';
import PointReport from '@/api/PointReport';
import PatrolShiftView from '@/api/PatrolShiftView';
import store from '@/composables/useVuex';
import { toastController } from '@ionic/vue';
import PatrolShift from '@/api/PatrolShift';
import Sync from '@/api/Sync';
import { useI18n } from 'vue-i18n';

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

  const buildFormData = async (item: PendingItem): Promise<FormData> => {
    const fb = new FormData();

    // 1. Append các trường phẳng (Primitive)
    fb.append('psId', item.data.psId.toString());
    fb.append('routeId', item.data.routeId.toString());
    fb.append('rdId', item.data.rdId.toString());
    fb.append('prHasProblem', item.data.prHasProblem ? 'true' : 'false');
    fb.append('prNote', item.data.prNote || '');
    fb.append('createdAt', item.data.createdAt);
    fb.append('createdBy', item.data.createdBy);
    fb.append('scanAt', item.data.scanAt || item.data.createdAt);

    // 2. Xử lý noteGroups theo chuẩn Index lồng nhau
    if (item.data.noteGroups && Array.isArray(item.data.noteGroups)) {
      let globalImageIndex = 0;

      // SỬA: Dùng vòng lặp for...of để await có tác dụng
      for (let i = 0; i < item.data.noteGroups.length; i++) {
        const group = item.data.noteGroups[i];

        // Append Metadata cho từng Group
        fb.append(`noteGroups[${i}].prGroup`, group.prGroup.toString());
        fb.append(`noteGroups[${i}].priImageNote`, group.priImageNote || '');

        // 3. Xử lý ảnh lồng trong từng Group
        if (group.reportImages && group.reportImages.length > 0) {
          // SỬA: Tiếp tục dùng vòng lặp for để đợi đọc ảnh
          for (let j = 0; j < group.reportImages.length; j++) {
            const fileName = item.imageFiles[globalImageIndex];

            if (fileName) {
              const base64 = await ImageService.readImage(fileName);
              if (base64) {
                const res = await fetch(`data:image/jpeg;base64,${base64}`);
                const blob = await res.blob();

                // Append đúng cấu trúc List<IFormFile> lồng trong List<Group>
                fb.append(`noteGroups[${i}].reportImages`, blob, `group${i}_img${j}.jpg`);
              }
            }
            globalImageIndex++;
          }
        }
      }
    }

    return fb;
  };

  const presentToast = async (message: string, color: string = 'warning') => {
    const toast = await toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  };

  const loadPendingItems = async (): Promise<void> => {
    const data = await storage.get('offline_api_queue');
    pendingItems.value = (data as PendingItem[]) || [];
  };

  const removeQueueItem = async (id: string | number) => {
    const currentQueue: PendingItem[] = (await storage.get('offline_api_queue')) || [];
    const updatedQueue = currentQueue.filter((q) => q.id !== id);
    await storage.set('offline_api_queue', updatedQueue);
    pendingItems.value = updatedQueue;
  };

  // Hàm dọn dẹp tập trung: Xóa ảnh vật lý + Xóa Mock Vuex + Xóa Queue SQLite
  const cleanUpItem = async (item: PendingItem) => {
    // 1. Xóa ảnh trong máy
    if (item.imageFiles?.length > 0) {
      for (const fileName of item.imageFiles) {
        await ImageService.deleteImage(fileName).catch(() => { });
      }
    }
    // 2. Xóa báo cáo ảo (Mock) khỏi RAM
    storeInstance.commit('REMOVE_OFFLINE_REPORT', item.id);
    // 3. Xóa khỏi hàng chờ SQLite
    await removeQueueItem(item.id);
  };

  const addToQueue = async (item: PendingItem): Promise<void> => {
    // 1. CLONE (Tạo bản sao) để không làm ảnh hưởng data gốc đang gửi trực tiếp
    const itemToSave = JSON.parse(JSON.stringify(item));

    // 2. RÚT RUỘT BASE64: Xóa trắng chuỗi Base64 nặng nề trước khi lưu vào SQLite
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
    await loadPendingItems();

    const actualUser: any = storeInstance.state.dataUser;
    const userData = actualUser?.data ? actualUser.data : actualUser;

    // Tạo báo cáo ảo để hiển thị ngay trên UI (Giữ nguyên của bạn)
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

    await presentToast(t('messages.use-offline.saved-to-queue'));
    storeInstance.commit('ADD_OFFLINE_REPORT', mockReport);
  };

  const sendData = async (url: string, data: any, imagesBase64: string[] = []): Promise<void> => {
    const id = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    const imageFiles: string[] = [];

    // Lưu ảnh vật lý trước để giải phóng RAM
    for (const base64 of imagesBase64) {
      try {
        const fileName = await ImageService.saveImage(base64);
        imageFiles.push(fileName);
      } catch (err) {
        console.error("Lỗi lưu ảnh vật lý:", err);
      }
    }

    const newItem: PendingItem = { id, url, data, imageFiles };

    if (storeInstance.state.isOnline) {
      try {
        const bodyFormData = await buildFormData(newItem);

        const result = await PointReport.createPointReport(bodyFormData);
        const realReport = result?.data?.data || result?.data || result;

        // Thành công: Xóa ảnh và Queue ngay
        await cleanUpItem(newItem);

        if (realReport) {
          storeInstance.commit('ADD_OFFLINE_REPORT', realReport);
        }
      } catch (error) {
        console.warn("Gửi trực tiếp thất bại, chuyển vào hàng chờ...");
        await addToQueue(newItem);
      }
    } else {
      await addToQueue(newItem);
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

    console.log("--- [START] BẮT ĐẦU ĐỒNG BỘ ---");

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
      await loadPendingItems();
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

        const originalTime = new Date(item.data.createdAt);
        let isAlreadyOnServer = false;
        const actualUser: any = storeInstance.state.dataUser;
        const userData = actualUser?.data ? actualUser.data : actualUser;

        // Kiểm tra xem dữ liệu đã tồn tại trên Server chưa (Tránh gửi trùng khi mạng chập chờn)
        try {
          // SỬA CHÍNH XÁC Ở ĐÂY: Thay psHour bằng psId để check đích danh ca trực
          const checkInfo = {
            psId: item.data.psId,
            psDay: originalTime.getDate(),
            psMonth: originalTime.getMonth() + 1,
            psYear: originalTime.getFullYear(),
            areaId: item.data.areaId || userData?.userAreaId
          };

          const res: any = await PatrolShiftView.postPatrolShiftView(checkInfo);
          const routes = Array.isArray(res.data) ? res.data : (res.data?.data || []);

          isAlreadyOnServer = routes.some((r: any) =>
            r.routeDetails?.some((rd: any) =>
              String(rd.cpId) === String(item.data.cpId) && rd.status === 1
            )
          );
        } catch (e) {
          console.warn("Không thể kiểm tra trạng thái Server, thử gửi trực tiếp.");
        }

        if (isAlreadyOnServer) {
          console.log(`[Sync] Điểm ${item.data.cpId} đã có trên Server. Dọn dẹp Mock.`);
          await cleanUpItem(item);
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
          const realReport = result?.data?.data || result?.data || result;

          await cleanUpItem(item);

          if (realReport) {
            storeInstance.commit('ADD_OFFLINE_REPORT', realReport);
          }
        } catch (error: any) {
          const statusCode = error.response?.status || error.status;
          // Lỗi 400/409/422 thường là dữ liệu đã tồn tại hoặc không hợp lệ -> Xóa bỏ để tránh kẹt Queue
          if ([400, 409, 422].includes(statusCode)) {
            await cleanUpItem(item);
          } else {
            console.error("Lỗi mạng/Server, dừng tiến trình Sync.");
            if (statusCode >= 500) {
              await presentToast(t('messages.use-offline.maintenance'), 'danger');
            }
            break;
          }
        }
      }
    } catch (e) {
      console.error("Lỗi tổng quát Sync:", e);
    } finally {
      await loadPendingItems();
      // Delay nhỏ để UI mượt mà hơn trước khi tắt trạng thái Syncing
      setTimeout(() => {
        isProcessing = false;
        storeInstance.commit('SET_SYNC_OFFLINE_STATUS', false);
        isSyncing.value = false;

        storeInstance.commit('SET_SYNC_STATUS', {
          progress: 100,
          message: t('messages.use-offline.completed'),
          isSyncing: false,
          mode: 'silent'
        });
        console.log("--- [END] KẾT THÚC ĐỒNG BỘ ---");
      }, 800);
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
    addToQueue // Trả về để có thể dùng nếu cần
  };
}