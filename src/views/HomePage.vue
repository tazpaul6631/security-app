<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Multi Image Base64</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
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
          <p>{{ photos }}</p>
        </ion-label>
      </ion-item>

      <ion-button v-if="photos.length > 0" expand="block" color="success" @click="uploadPhotos">
        Gửi Dữ Liệu
      </ion-button>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, 
  IonButton, IonImg, IonIcon, IonGrid, IonRow, IonCol, IonItem, IonLabel ,alertController, 
  loadingController 
} from '@ionic/vue';
import { camera, trash, images } from 'ionicons/icons';
import { Camera, CameraResultType, CameraDirection, CameraSource } from '@capacitor/camera';

// Định nghĩa kiểu dữ liệu cho ảnh
interface UserPhoto {
  date?: string;
  rawBase64?: string;  // Chuỗi base64 thuần (để gửi lên Server)
  fileName?: string;   // Tên file (nếu cần)
  preview?: string;    // Dùng để hiển thị (có prefix data:image...)
}

// State lưu trữ mảng ảnh
const photos = ref<UserPhoto[]>([]);

// Lấy thời gian hiện tại
const getCurrentIsoTime = () => new Date().toISOString().split('.')[0] + 'Z';

//Convert Blob sang Base64 (Bắt buộc phải có)
const convertBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(blob);
  });
};

//Chọn nhiều ảnh
const pickMultipleImages = async () => {
  try {
    // Gọi Gallery native để chọn nhiều ảnh
    const result = await Camera.pickImages({
      quality: 80, // Chất lượng ảnh
      limit: 10    // Giới hạn số lượng ảnh được chọn (0 = không giới hạn)
    });

    // Hiển thị loading vì convert nhiều ảnh sẽ tốn thời gian
    const loading = await loadingController.create({
      message: 'Đang xử lý ảnh...',
      duration: 5000 // Tự tắt sau 5s đề phòng lỗi
    });
    await loading.present();

    // Duyệt qua từng ảnh đã chọn để convert sang Base64
    // Sử dụng Promise.all để xử lý song song cho nhanh
    const processedPhotos = await Promise.all(result.photos.map(async (photo) => {
      // photo.webPath là đường dẫn tạm thời trên thiết bị
      // Dùng fetch để lấy dữ liệu file từ đường dẫn đó
      const response = await fetch(photo.webPath!);
      const blob = await response.blob();
      
      // Convert sang Base64
      const fullBase64 = await convertBlobToBase64(blob);
      
      // Tách header để lấy rawBase64 (gửi server)
      // fullBase64 dạng: "data:image/jpeg;base64,/9j/4AAQ..."
      const rawBase64 = fullBase64.split(',')[1];
      // lấy name hình jpeg png
      const rawName = fullBase64.split('/')[1].split(';')[0];

      return {
        date: getCurrentIsoTime(),
        fileName: rawName,
        rawBase64: rawBase64, // Dùng để gửi API
        preview: fullBase64,  // Dùng để hiển thị
      };
    }));

    // Gộp ảnh mới vào danh sách cũ
    photos.value = [...photos.value, ...processedPhotos];

    await loading.dismiss(); // Tắt loading

  } catch (error) {
    photos.value = [];
    // Lưu ý: Nếu user mở gallery lên xong bấm "Back" không chọn gì,
    // code sẽ nhảy vào đây. Bạn có thể bỏ qua không cần alert lỗi.
  }
};

const addPhoto = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 60,       // Giảm chất lượng xuống 60-70% (mắt thường khó nhận ra khác biệt nhưng file nhẹ hơn nhiều)
      width: 1024,       // Giới hạn chiều rộng tối đa 1024px
      height: 1024,      // Giới hạn chiều cao tối đa
      allowEditing: false, 
      resultType: CameraResultType.Base64,
      // 2. Cấu hình Camera mặc định
      // CameraDirection.Rear : Camera sau (Chính)
      // CameraDirection.Front: Camera trước (Selfie)
      direction: CameraDirection.Rear, 
      
      // Nếu bạn muốn ép buộc chỉ được chụp (không cho chọn thư viện) thì dùng dòng dưới:
      source: CameraSource.Camera
      // source: CameraSource.Prompt
    });

    if (image.base64String) {
      // Tạo object ảnh mới
      const newPhoto: UserPhoto = {
        date: getCurrentIsoTime(),
        fileName: image.format,
        rawBase64: image.base64String, // gửi api
        preview: `data:image/${image.format};base64,${image.base64String}` // hiênt thị hình
      };

      // PUSH vào mảng thay vì gán đè
      photos.value.push(newPhoto);
    }

  } catch (error) {
    photos.value = [];
    console.log('User cancelled or error:', error);
  }
};

// Hàm xóa ảnh khỏi mảng theo index
const removePhoto = (index: number) => {
  photos.value.splice(index, 1);
};

// Hàm upload ảnh lên Server
const uploadPhotos = async () => {
  // Nếu không check = array[]
  if (photos.value.length === 0) photos.value = [];

  // 1. Hiển thị Loading
  const loading = await loadingController.create({
    message: 'Đang gửi dữ liệu...',
    spinner: 'crescent' // Kiểu vòng xoay
  });
  await loading.present();

  try {
    // Chuẩn bị dữ liệu (Payload)
    const payload = {
      userId: 'user_001', // Ví dụ ID người dùng
      note: 'Gửi ảnh từ Ionic App', // Các trường form khác nếu có
      images: photos.value.map((item, index) => {
        return {
          ...item,               // Giữ lại thuộc tính cũ nếu có
          ...photos.value[index] // Ghi đè dữ liệu mới từ nguồn vào theo vị trí tương ứng
        }
      }) // Trích xuất mảng string Base64
    };

    // Gọi API (Dùng Fetch hoặc Axios)
    // Thay 'https://api.cuaban.com/upload' bằng link API thật của bạn
    // const response = await fetch('https://your-api-endpoint.com/api/upload', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json', // Quan trọng: báo server đây là JSON
    //     // 'Authorization': 'Bearer ...' // Nếu cần token
    //   },
    //   body: JSON.stringify(payload)
    // });

    // const result = await response.json();

    // 4. Xử lý kết quả trả về
    // if (response.ok) {
    //   // Thành công
    //   await loading.dismiss(); // Tắt loading
      
    //   const alert = await alertController.create({
    //     header: 'Thành công',
    //     message: 'Đã upload ảnh xong!',
    //     buttons: ['OK'],
    //   });
    //   await alert.present();

    //   // Reset mảng ảnh sau khi gửi thành công
    //   photos.value = []; 

    // } else {
    //   // Server trả về lỗi
    //   throw new Error(result.message || 'Lỗi từ server');
    // }

  } catch (error: any) {
    // 5. Xử lý lỗi mạng hoặc lỗi code
    await loading.dismiss(); // Tắt loading
    console.error(error);
    
    const alert = await alertController.create({
      header: 'Thất bại',
      message: 'Không gửi được ảnh: ' + error.message,
      buttons: ['Đóng'],
    });
    await alert.present();
  }
};
</script>

<style scoped>
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
