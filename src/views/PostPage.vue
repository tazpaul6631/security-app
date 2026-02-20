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

          <ion-row class="ion-margin-bottom">
            <ion-col>
              <ion-button expand="block" @click="addPhoto">
                <ion-icon slot="start" :icon="camera"></ion-icon>
                Chụp Mới
              </ion-button>
            </ion-col>
            
            <ion-col>
              <ion-button expand="block" color="secondary" @click="pickMultipleImages">
                <ion-icon slot="start" :icon="images"></ion-icon>
                Chọn Nhiều
              </ion-button>
            </ion-col>
          </ion-row>

          <ion-grid v-if="photos.length > 0">
            <ion-row>
              <ion-col size="6" size-md="4" v-for="(photo, index) in photos" :key="index">
                <div class="image-container">
                  <ion-img :src="photo.preview" class="thumb-img"></ion-img>
                  
                  <div class="delete-btn" @click="removePhoto(index)">
                    <ion-icon :icon="trash"></ion-icon>
                  </div>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>

          <ion-item v-if="photos.length > 0" class="ion-margin-top">
            <ion-label class="ion-text-wrap">
              <p><strong>Tổng số ảnh:</strong> {{ photos.length }}</p>
              <p>Dữ liệu đã sẵn sàng trong biến <code>photos</code> để gửi API.</p>
              <!-- <p>{{ photos }}</p> -->
            </ion-label>
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
              <h2>{{ item.data.note || 'Không có nội dung' }}</h2>
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
                <h2>{{ item.data.note || 'Không có tiêu đề' }}</h2>
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
  IonIcon, IonListHeader, IonGrid, IonRow, IonCol, loadingController, IonThumbnail, IonImg
} from '@ionic/vue';
import { sendOutline, cloudOfflineOutline, trashOutline } from 'ionicons/icons';
import { useOfflineManager } from '@/composables/useOfflineManager';
import storage from '@/services/storage.service';
import { ImageService } from '@/services/image.service';

const { isOnline, sendData, pendingItems, loadPendingItems, syncData } = useOfflineManager();
const postContent = ref('');

const handleSubmit = async () => {
  if (!postContent.value.trim()) return;

  try {
    const loading = await loadingController.create({ message: 'Đang lưu...' });
    await loading.present();

    // 1. Lấy danh sách các chuỗi base64 thực sự (không có header data:image/...) 
    // hoặc giữ nguyên tùy vào logic của sendData/ImageService của bạn.
    const base64Images = photos.value.map(p => p.rawBase64);

    // 2. Truyền đúng dữ liệu vào sendData
    // Giả sử sendData(previewUrl, data, base64Array)
    await sendData(
      photos.value[0]?.preview || null, // Lấy ảnh đầu tiên làm thumbnail preview
      { 
        userId: 'user_001', // Ví dụ ID người dùng
        note: postContent.value, // Các trường form khác nếu có
        images: photos.value.map((item, index) => {
          return {
            ...item,               // Giữ lại thuộc tính cũ nếu có
            ...photos.value[index] // Ghi đè dữ liệu mới từ nguồn vào theo vị trí tương ứng
          }
        })
      }, 
      base64Images 
    );

    // 3. Reset form
    postContent.value = ''; 
    photos.value = []; // Xóa danh sách ảnh sau khi gửi thành công
    
    await loadPendingItemsWithImages(); // Cập nhật lại danh sách hiển thị
    await loading.dismiss();
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
    await loadPendingItemsWithImages();
  }
};

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString();
};

const displayItems = ref([]);

const loadPendingItemsWithImages = async () => {
  await loadPendingItems(); // Lấy dữ liệu thật từ useOfflineManager (từ Storage)
  
  // Xử lý dữ liệu thật từ Storage
  const itemsWithUrls = await Promise.all(pendingItems.value.map(async (item) => {
    let thumb = null;
    if (item.imageFiles && item.imageFiles.length > 0) {
      // Lấy ảnh đầu tiên làm ảnh đại diện (thumbnail)
      thumb = await ImageService.getDisplayUrl(item.imageFiles[0]);
    }
    return { ...item, thumb };
  }));
  
  // KẾT HỢP: Đưa dữ liệu giả lên đầu hoặc cuối danh sách để đối chiếu
  // Ở đây tôi đưa dữ liệu giả lên đầu để bạn dễ thấy
  displayItems.value = [...mockData, ...itemsWithUrls];
  console.log(displayItems.value);

  // await loadPendingItems(); // Gọi từ useOfflineManager
  
  // const itemsWithUrls = await Promise.all(pendingItems.value.map(async (item) => {
  //   let thumb = null;
  //   if (item.imageFiles && item.imageFiles.length > 0) {
  //     // Lấy ảnh đầu tiên làm ảnh đại diện (thumbnail)
  //     thumb = await ImageService.getDisplayUrl(item.imageFiles[0]);
  //   }
  //   return { ...item, thumb };
  // }));
  
  // displayItems.value = itemsWithUrls;
};

/////////////////////////////////
import { camera, trash, images } from 'ionicons/icons';
import { Camera, CameraResultType, CameraDirection, CameraSource } from '@capacitor/camera';

// Thêm đoạn này vào phần <script setup>
const mockData = [
  {
    id: 1715832000000, // Timestamp giả
    data: {
      note: "Bài viết mẫu: Chuyến đi thực tế tại Đà Lạt",
      images: ['image1.jpg', 'image2.jpg'],
    },
    imageFiles: ['image1.jpg', 'image2.jpg'],
    thumb: "https://picsum.photos/200/200?random=1", // Ảnh placeholder từ internet
    isMock: true
  },
  {
    id: 1715832060000,
    note: "Kiểm tra hệ thống offline: Đã lưu 3 ảnh",
    userId: 'user_002',
    data: {
      // text: "Kiểm tra hệ thống offline: Đã lưu 3 ảnh",
      userId: 'user_001',
      note: 'Đang chờ gửi'
    },
    imageFiles: ['image3.jpg'],
    thumb: "https://picsum.photos/200/200?random=2",
    isMock: true
  }
];

// State lưu trữ mảng ảnh
const photos = ref([]);

// Lấy thời gian hiện tại chuẩn ISO
const getCurrentIsoTime = () => new Date().toISOString().split('.')[0] + 'Z';

// Convert Blob sang Base64
const convertBlobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
};

//Chọn nhiều ảnh
const pickMultipleImages = async () => {
  try {
    const result = await Camera.pickImages({
      quality: 80,
      limit: 10
    });

    // Hiển thị loading (Cần đảm bảo đã import loadingController từ @ionic/vue)
    const loading = await loadingController.create({
      message: 'Đang xử lý ảnh...',
      duration: 5000
    });
    await loading.present();

    const processedPhotos = await Promise.all(result.photos.map(async (photo) => {
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      
      const fullBase64 = await convertBlobToBase64(blob);
      
      // Tách raw base64 và lấy định dạng file
      const rawBase64 = fullBase64.split(',')[1];
      const rawName = fullBase64.split('/')[1].split(';')[0];

      return {
        date: getCurrentIsoTime(),
        fileName: rawName,
        rawBase64: rawBase64,
        preview: fullBase64,
      };
    }));

    photos.value = [...photos.value, ...processedPhotos];
    await loading.dismiss();

  } catch (error) {
    console.error('Lỗi khi chọn ảnh:', error);
    // Không nên reset mảng về [] ở đây nếu user chỉ nhấn "Hủy"
  }
};

const addPhoto = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 60,
      width: 1024,
      height: 1024,
      allowEditing: false, 
      resultType: CameraResultType.Base64,
      direction: CameraDirection.Rear, 
      source: CameraSource.Camera
    });

    if (image.base64String) {
      const newPhoto = {
        date: getCurrentIsoTime(),
        fileName: image.format,
        rawBase64: image.base64String,
        preview: `data:image/${image.format};base64,${image.base64String}`
      };

      photos.value.push(newPhoto);
    }
  } catch (error) {
    console.log('User cancelled or error:', error);
  }
};

// Hàm xóa ảnh khỏi mảng theo index
const removePhoto = (index) => {
  photos.value.splice(index, 1);
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

.image-container {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  aspect-ratio: 1 / 1; /* Giữ khung hình vuông */
  background: #f0f0f0;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Nút xóa nằm góc trên phải */
.delete-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(255, 0, 0, 0.8);
  color: white;
  border-radius: 50%;
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
}
</style>