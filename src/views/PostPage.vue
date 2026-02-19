<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Gửi Dữ Liệu Offline</ion-title>
        <ion-badge slot="end" :color="isOnline ? 'success' : 'danger'" class="ion-margin-end">
          {{ isOnline ? 'Online' : 'Offline' }}
        </ion-badge>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-header>
          <ion-card-title>Đăng bài mới</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label position="stacked">Nội dung</ion-label>
            <ion-textarea v-model="postContent" placeholder="Nhập gì đó..."></ion-textarea>
          </ion-item>
          <ion-button expand="block" class="ion-margin-top" @click="handleSubmit">
            <ion-icon slot="start" :icon="sendOutline"></ion-icon>
            Gửi dữ liệu
          </ion-button>
        </ion-card-content>
      </ion-card>

      <ion-list lines="full">
        <ion-item-sliding v-for="item in displayItems" :key="item.id">
          <ion-item>
            <ion-thumbnail slot="start" v-if="item.thumb">
              <img :src="item.thumb" />
            </ion-thumbnail>
            <ion-icon v-else slot="start" :icon="cloudOfflineOutline" color="warning"></ion-icon>
            
            <ion-label>
              <h2>{{ item.data.text || 'Không có nội dung' }}</h2>
              <p>{{ item.imageFiles?.length || 0 }} ảnh - {{ formatDate(item.id) }}</p>
            </ion-label>
          </ion-item>
          
          <ion-item-options side="end">
            <ion-item-option color="danger" @click="deleteItem(item.id)">
              <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <div v-if="pendingItems.length > 0" class="ion-margin-top">
        <ion-list-header>
          <ion-label>Đang chờ đồng bộ ({{ pendingItems.length }})</ion-label>
          <ion-button @click="syncData">Thử lại ngay</ion-button>
        </ion-list-header>

        <ion-list lines="full">
          <ion-item-sliding v-for="item in pendingItems" :key="item.id">
            <ion-item>
              <ion-icon slot="start" :icon="cloudOfflineOutline" color="warning"></ion-icon>
              <ion-label>
                <h2>{{ item.data.text || 'Không có tiêu đề' }}</h2>
                <p>{{ item.imageFiles.length }} hình ảnh - {{ formatDate(item.id) }}</p>
              </ion-label>
            </ion-item>

            <ion-item-options side="end">
              <ion-item-option color="danger" @click="deleteItem(item.id)">
                <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
              </ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, 
  IonTextarea, IonButton, IonBadge, IonCard, IonCardContent, IonCardHeader, 
  IonCardTitle, IonList, IonItemSliding, IonItemOptions, IonItemOption, 
  IonIcon, IonListHeader 
} from '@ionic/vue';
import { sendOutline, cloudOfflineOutline, trashOutline } from 'ionicons/icons';
import { useOfflineManager } from '../composables/useOfflineManager';
import storage from '../services/storage.service';
import { ImageService } from '../services/image.service';

const { isOnline, sendData, pendingItems, loadPendingItems, syncData } = useOfflineManager();
const postContent = ref('');

// Giả lập lấy ảnh Base64 (Thực tế bạn lấy từ Camera/Gallery)
const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const handleSubmit = async () => {
  if (!postContent.value.trim()) return;

  try {
    // Nên thêm loading indicator ở đây
    await sendData('https://api.example.com/posts', 
      { text: postContent.value }, 
      [dummyBase64] // Đảm bảo trong sendData đã có logic lưu file xuống máy
    );

    postContent.value = ''; 
    // loadPendingItems(); // Nếu useOfflineManager không tự cập nhật ref
  } catch (error) {
    console.error("Gửi dữ liệu thất bại:", error);
  }
};

const deleteItem = async (id) => {
  // 1. Lấy dữ liệu mới nhất từ Storage để đảm bảo an toàn
  const currentQueue = await storage.get('offline_api_queue') || [];
  const itemToDelete = currentQueue.find(i => i.id === id);

  if (itemToDelete) {
    // 2. Xóa các file vật lý trước
    try {
      for (const fileName of itemToDelete.imageFiles) {
        await ImageService.deleteImage(fileName);
      }
    } catch (e) {
      console.error("Lỗi xóa file:", e);
    }

    // 3. Cập nhật lại Storage và UI
    const updatedQueue = currentQueue.filter(i => i.id !== id);
    await storage.set('offline_api_queue', updatedQueue);
    
    // Tùy vào useOfflineManager, có thể cần gọi loadPendingItems()
    await loadPendingItems(); 
  }
};

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString();
};

const displayItems = ref([]);

const loadPendingItemsWithImages = async () => {
  await loadPendingItems(); // Gọi từ useOfflineManager
  
  const itemsWithUrls = await Promise.all(pendingItems.value.map(async (item) => {
    let thumb = null;
    if (item.imageFiles && item.imageFiles.length > 0) {
      // Lấy ảnh đầu tiên làm ảnh đại diện (thumbnail)
      thumb = await ImageService.getDisplayUrl(item.imageFiles[0]);
    }
    return { ...item, thumb };
  }));
  
  displayItems.value = itemsWithUrls;
};

onMounted(() => {
  loadPendingItems();
  loadPendingItemsWithImages();
});
</script>

<style scoped>
ion-list-header {
  --background: #f4f5f8;
  border-radius: 8px;
}
</style>