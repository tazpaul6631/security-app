import { ref, onMounted } from 'vue';
import { Network, ConnectionStatus } from '@capacitor/network';
import storage from '../services/storage.service';
import { ImageService } from '../services/image.service';

// 1. Định nghĩa cấu trúc dữ liệu cho một mục trong hàng chờ
interface PendingItem {
  id: number;
  url: string;
  data: any;           // Dữ liệu JSON gửi kèm
  imageFiles: string[]; // Danh sách tên file ảnh đã lưu trong máy
}

export function useOfflineManager() {
  const isOnline = ref<boolean>(true);
  const pendingItems = ref<PendingItem[]>([]);

  // --- 1. Theo dõi trạng thái mạng ---
  const initializeNetwork = async (): Promise<void> => {
    const status: ConnectionStatus = await Network.getStatus();
    isOnline.value = status.connected;

    // Lắng nghe sự thay đổi mạng
    await Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      isOnline.value = status.connected;
      if (status.connected) {
        console.log('Mạng đã kết nối lại. Bắt đầu đồng bộ...');
        syncData(); 
      }
    });
  };

  // --- 2. Tải danh sách chờ từ Storage ---
  const loadPendingItems = async (): Promise<void> => {
    const data = await storage.get('offline_api_queue');
    pendingItems.value = (data as PendingItem[]) || [];
  };

  // --- 3. Hàm gửi dữ liệu (Xử lý cả Online/Offline) ---
  const sendData = async (url: string, data: any, imagesBase64: string[] = []): Promise<void> => {
    const id = Date.now();
    
    // Lưu ảnh vật lý vào máy và lấy tên file (Tránh làm nặng Storage)
    const imageFiles: string[] = [];
    for (const base64 of imagesBase64) {
      try {
        const fileName = await ImageService.saveImage(base64); 
        imageFiles.push(fileName);
      } catch (err) {
        console.error("Lỗi lưu ảnh vật lý:", err);
      }
    }

    const newItem: PendingItem = { id, url, data, imageFiles };

    if (isOnline.value) {
      try {
        await uploadToServer(newItem);
        // Gửi xong thì xóa file ảnh cho sạch máy
        for (const f of imageFiles) await ImageService.deleteImage(f);
      } catch (error) {
        console.warn("Gửi trực tiếp thất bại, chuyển vào hàng chờ...");
        await addToQueue(newItem);
      }
    } else {
      console.log("Đang offline, đã lưu vào hàng chờ.");
      await addToQueue(newItem);
    }
  };

  const addToQueue = async (item: PendingItem): Promise<void> => {
    const queue: PendingItem[] = await storage.get('offline_api_queue') || [];
    queue.push(item);
    await storage.set('offline_api_queue', queue);
    await loadPendingItems();
  };

  // --- 4. Cơ chế đồng bộ (Sync) ---
  const syncData = async (): Promise<void> => {
    if (!isOnline.value || pendingItems.value.length === 0) return;

    // Copy mảng để xử lý tránh xung đột dữ liệu khi đang lặp
    const queue = [...pendingItems.value];
    
    for (const item of queue) {
      try {
        await uploadToServer(item);

        // Thành công: Xóa khỏi Storage
        const currentQueue: PendingItem[] = await storage.get('offline_api_queue') || [];
        const updatedQueue = currentQueue.filter(i => i.id !== item.id);
        await storage.set('offline_api_queue', updatedQueue);
        
        // Xóa ảnh vật lý sau khi đã tải lên thành công
        for (const f of item.imageFiles) {
          await ImageService.deleteImage(f);
        }
        
        console.log(`Đồng bộ thành công item: ${item.id}`);
      } catch (e) {
        console.error("Đồng bộ thất bại, dừng hàng chờ để thử lại sau:", item.id);
        break; 
      }
    }
    // Cập nhật lại UI sau khi đồng bộ
    await loadPendingItems();
  };

  // --- 5. Giả lập hàm Upload (Thay bằng logic thực tế của bạn) ---
  const uploadToServer = async (item: PendingItem): Promise<any> => {
    console.log("Đang tải dữ liệu lên server...", item);
    // Ví dụ thực tế: 
    // return axios.post(item.url, { ...item.data, images: item.imageFiles });
    return new Promise((resolve) => setTimeout(resolve, 2000)); 
  };

  onMounted(() => {
    initializeNetwork();
    loadPendingItems();
  });

  return { 
    isOnline, 
    pendingItems, 
    sendData, 
    loadPendingItems, 
    syncData 
  };
}