import { ref, computed } from 'vue';
import storage from '@/services/storage.service';
import { ImageService } from '@/services/image.service';
import PointReport from '@/api/PointReport';
import PatrolShiftView from '@/api/PatrolShiftView'; // Import API kiểm tra lộ trình
import store from '@/composables/useVuex';
import { toastController } from '@ionic/vue';

// --- TRẠNG THÁI GLOBAL (Singleton) ---
const pendingItems = ref<PendingItem[]>([]);
const isSyncing = ref(false);

// BIẾN QUAN TRỌNG: Chặn vòng lặp logic (không gây re-render)
let isInternalProcessing = false;

const presentToast = async (message: string) => {
  const toast = await toastController.create({
    message: message,
    duration: 3000,
    position: 'top',
    color: 'warning'
  });
  await toast.present();
};

// Đổi id thành kiểu string | number để dùng ID ngẫu nhiên an toàn hơn
interface PendingItem {
  id: string | number;
  url: string;
  data: any;
  imageFiles: string[];
}

export function useOfflineManager() {

  const loadPendingItems = async (): Promise<void> => {
    const data = await storage.get('offline_api_queue');
    pendingItems.value = (data as PendingItem[]) || [];
  };

  // Helper function để xóa item khỏi SQLite và state cho gọn code
  const removeQueueItem = async (id: string | number) => {
    const currentQueue: PendingItem[] = await storage.get('offline_api_queue') || [];
    const updatedQueue = currentQueue.filter(q => q.id !== id);
    await storage.set('offline_api_queue', updatedQueue);
    pendingItems.value = updatedQueue;
  };

  const sendData = async (url: string, data: any, imagesBase64: string[] = []): Promise<void> => {
    // 1. FIX LỖI ID TRÙNG: Sinh ID kết hợp random để chống dội (Race Condition)
    const id = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    const imageFiles: string[] = [];

    // Lưu ảnh vào bộ nhớ máy
    for (const base64 of imagesBase64) {
      try {
        const fileName = await ImageService.saveImage(base64);
        imageFiles.push(fileName);
      } catch (err) {
        console.error("Lỗi lưu ảnh vật lý:", err);
      }
    }

    const newItem: PendingItem = { id, url, data, imageFiles };

    // Kiểm tra mạng từ Vuex
    if (store.state.isOnline) {
      try {
        const result = await uploadToServer(newItem);
        console.log("Gửi trực tiếp thành công:", result);

        // Đắp data THẬT vào màn hình danh sách điểm (nếu user đang xem)
        const realReport = result?.data?.data || result?.data || result;
        if (realReport) {
          store.commit('ADD_OFFLINE_REPORT', realReport);
        }

        // Thành công: Xóa ảnh ngay
        for (const f of imageFiles) await ImageService.deleteImage(f);
      } catch (error) {
        console.warn("Gửi trực tiếp thất bại, chuyển vào hàng chờ...");
        await addToQueue(newItem);
      }
    } else {
      await addToQueue(newItem);
    }
  };

  const addToQueue = async (item: PendingItem): Promise<void> => {
    const queue: PendingItem[] = await storage.get('offline_api_queue') || [];
    queue.push(item);

    await storage.set('offline_api_queue', queue);
    await loadPendingItems();

    const actualUser: any = store.state.dataUser;
    const userData = actualUser?.data ? actualUser.data : actualUser;
    const scanData: any = store.state.dataScanQr || {};

    const mockReport = {
      psId: item.data.psId,
      prId: item.id,
      routeId: item.data.routeId,
      rdId: item.data.rdId,
      cpId: item.data.cpId,
      cpName: scanData.cpName || item.data.cpCode || 'Khu vực (Đang Offline)',
      createdName: userData?.fullName || 'Tôi (Offline)',
      createdAt: item.data.createdAt || new Date().toISOString(),
      prHasProblem: item.data.prHasProblem,
      prNote: item.data.prNote,
      isOfflineMock: true,
      reportImages: item.data.images || []
    };

    await presentToast('Đã lưu vào hàng chờ. Sẽ tự động gửi khi có mạng.');
    store.commit('ADD_OFFLINE_REPORT', mockReport);
  };

  // --- TIẾN TRÌNH ĐỒNG BỘ CHÍNH ---
  const syncData = async (): Promise<void> => {
    // 1. CHẶN TRÙNG LẶP: Nếu đang chạy hoặc mất mạng thì thoát ngay
    if (isInternalProcessing || !store.state.isOnline) {
      return;
    }

    // 2. KHÓA TIẾN TRÌNH
    isInternalProcessing = true;
    isSyncing.value = true;
    console.log("--- [START] BẮT ĐẦU TIẾN TRÌNH ĐỒNG BỘ ---");

    try {
      await loadPendingItems();
      const queue = [...pendingItems.value];

      if (queue.length === 0) {
        console.log("--- Hàng chờ trống, dừng Sync ---");
        return;
      }

      // --- 3. FIX LỖI DUPLICATE: CHECK BEFORE SYNC ---
      // Kéo danh sách Server về xem có điểm nào đã hoàn thành rồi không
      let serverCompletedCpIds: string[] = [];
      try {
        const actualUser: any = store.state.dataUser;
        const userData = actualUser?.data ? actualUser.data : actualUser;
        const now = new Date();
        const dateInfo = {
          psDay: now.getDate(),
          psMonth: now.getMonth() + 1,
          psYear: now.getFullYear(),
          psHour: now.getHours(), // Lấy theo giờ hiện tại
          isComplete: false,
          areaId: userData?.userAreaId
        };
        const res: any = await PatrolShiftView.postPatrolShiftView(dateInfo);
        const routes = Array.isArray(res.data) ? res.data : (res.data?.data || []);

        routes.forEach((r: any) => {
          r.routeDetails?.forEach((rd: any) => {
            if (rd.status === 1) serverCompletedCpIds.push(String(rd.cpId));
          });
        });
      } catch (e) {
        console.warn("Cảnh báo: Không thể check trạng thái Server trước khi Sync", e);
      }
      // ----------------------------------------------

      for (const item of queue) {
        if (!store.state.isOnline) break;

        // KIỂM TRA TRƯỚC KHI GỬI
        const targetCpId = String(item.data.cpId);
        if (serverCompletedCpIds.includes(targetCpId)) {
          console.log(`[Check-Before-Sync] Điểm ${targetCpId} đã ghi nhận trên Server. Bỏ qua gửi đúp.`);

          store.commit('REMOVE_OFFLINE_REPORT', item.id);
          await removeQueueItem(item.id);
          if (item.imageFiles?.length > 0) {
            for (const fileName of item.imageFiles) {
              await ImageService.deleteImage(fileName).catch(() => { });
            }
          }
          continue; // Bỏ qua phần uploadToServer, đi tới item tiếp theo
        }

        try {
          const result = await uploadToServer(item);
          const realReport = result?.data?.data || result?.data || result; // Lấy dữ liệu thật API trả về

          // Thành công: Xóa ảnh vật lý
          if (item.imageFiles?.length > 0) {
            for (const fileName of item.imageFiles) {
              await ImageService.deleteImage(fileName).catch(() => { });
            }
          }

          // FIX LỖI MẤT GIAO DIỆN: Thay báo cáo Mock bằng báo cáo Thật
          store.commit('REMOVE_OFFLINE_REPORT', item.id);
          if (realReport) {
            store.commit('ADD_OFFLINE_REPORT', realReport);
          }

          // Xóa khỏi SQLite Queue
          await removeQueueItem(item.id);

        } catch (error: any) {
          const statusCode = error.response?.status || error.status;

          if (statusCode === 400 || statusCode === 422) {
            console.error(`Dữ liệu sai (Lỗi ${statusCode}), xóa bỏ item:`, item.id);
            store.commit('REMOVE_OFFLINE_REPORT', item.id);
            await removeQueueItem(item.id);
            continue;
          } else {
            console.error(`Lỗi kết nối Server, tạm dừng Sync.`);
            break;
          }
        }
      }
    } catch (e) {
      console.error("Lỗi tổng quát Sync:", e);
    } finally {
      // 4. GIẢI PHÓNG KHÓA
      await loadPendingItems();
      isInternalProcessing = false;
      isSyncing.value = false;
      console.log("--- [END] KẾT THÚC TIẾN TRÌNH ĐỒNG BỘ ---");
    }
  };

  const uploadToServer = async (item: PendingItem): Promise<any> => {
    return await PointReport.createPointReport(item.data);
  };

  return {
    isOnline: computed(() => store.state.isOnline),
    isSyncing,
    pendingItems,
    sendData,
    loadPendingItems,
    syncData
  };
}