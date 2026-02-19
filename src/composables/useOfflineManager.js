import { ref, onMounted, onUnmounted } from 'vue';
import { Network } from '@capacitor/network';
import storage from '../services/storage.service';
import { ImageService } from '../services/image.service';

export function useOfflineManager() {
  const isOnline = ref(true);
  const pendingItems = ref([]);

  // 1. Theo dõi trạng thái mạng
  const initializeNetwork = async () => {
    const status = await Network.getStatus();
    isOnline.value = status.connected;

    Network.addListener('networkStatusChange', (status) => {
      isOnline.value = status.connected;
      if (status.connected) {
        syncData(); // Tự động đồng bộ khi có mạng lại
      }
    });
  };

  // 2. Tải danh sách chờ từ Storage
  const loadPendingItems = async () => {
    const data = await storage.get('offline_api_queue');
    pendingItems.value = data || [];
  };

  // 3. Hàm gửi dữ liệu (Xử lý cả Online/Offline)
  const sendData = async (url, data, imagesBase64 = []) => {
    const id = Date.now();
    
    // Lưu ảnh vật lý vào máy và lấy tên file (Tránh đầy bộ nhớ Storage)
    const imageFiles = [];
    for (const base64 of imagesBase64) {
      const fileName = await ImageService.saveImage(base64); 
      imageFiles.push(fileName);
    }

    const newItem = { id, url, data, imageFiles };

    if (isOnline.value) {
      try {
        await uploadToServer(newItem);
        // Gửi xong thì xóa file ảnh cho sạch máy
        for (const f of imageFiles) await ImageService.deleteImage(f);
      } catch (error) {
        await addToQueue(newItem);
      }
    } else {
      await addToQueue(newItem);
    }
  };

  const addToQueue = async (item) => {
    const queue = await storage.get('offline_api_queue') || [];
    queue.push(item);
    await storage.set('offline_api_queue', queue);
    await loadPendingItems();
  };

  // 4. Cơ chế đồng bộ (Sync)
  const syncData = async () => {
    if (!isOnline.value || pendingItems.value.length === 0) return;

    const queue = [...pendingItems.value];
    for (const item of queue) {
      try {
        await uploadToServer(item);
        // Thành công thì xóa khỏi hàng chờ
        const currentQueue = await storage.get('offline_api_queue');
        const updatedQueue = currentQueue.filter(i => i.id !== item.id);
        await storage.set('offline_api_queue', updatedQueue);
        
        // Xóa ảnh vật lý
        for (const f of item.imageFiles) await ImageService.deleteImage(f);
      } catch (e) {
        console.error("Đồng bộ item thất bại, sẽ thử lại sau:", item.id);
        break; // Dừng lại nếu server lỗi để tránh loop vô ích
      }
    }
    await loadPendingItems();
  };

  // Giả lập hàm Upload (Bạn thay bằng axios hoặc fetch)
  const uploadToServer = async (item) => {
    console.log("Đang tải dữ liệu lên server...", item);
    // Ví dụ: return axios.post(item.url, item.data);
    return new Promise((resolve) => setTimeout(resolve, 2000)); 
  };

  onMounted(() => {
    initializeNetwork();
    loadPendingItems();
  });

  return { isOnline, pendingItems, sendData, loadPendingItems, syncData };
}