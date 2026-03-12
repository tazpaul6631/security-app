<template>
  <ion-page>
    <ion-header>
      <ion-toolbar class="none-padding">
        <ion-buttons slot="start">
          <ion-back-button default-href="/checkpoint"></ion-back-button>
        </ion-buttons>
        <ion-title>
          {{ getPrIdData?.cpCode || 'Chi tiết' }} #{{ getPrIdData?.prId || '' }}
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="!getPrIdData" class="ion-padding ion-text-center no-route-container">
        <ion-icon :icon="calendarOutline" style="font-size: 64px; color: #ccc;"></ion-icon>
        <h3>Chưa có danh sách</h3>
        <ion-button fill="clear" @click="router.replace('/home')">Quay lại trang chủ</ion-button>
      </div>

      <ion-card v-else>
        <ion-modal :is-open="isModalOpen" @didDismiss="closeModal" class="image-modal">
          <div class="modal-wrapper">
            <ion-button fill="clear" color="light" class="close-modal-btn" @click="closeModal">
              Đóng
            </ion-button>

            <swiper :initial-slide="currentSlideIndex" :centered-slides="true" :space-between="20"
              style="width: 100%; height: 100%;">
              <swiper-slide v-for="(img, idx) in allImagesFlat" :key="idx" class="swiper-slide-content">
                <div class="slide-inner">
                  <ion-img :src="img.url"></ion-img>
                  <p class="image-caption">{{ img.note }}</p>
                </div>
              </swiper-slide>
            </swiper>
          </div>
        </ion-modal>

        <ion-card-header>
          <div class="status-badge"
            :class="getPrIdData.prHasProblem && getPrIdData.prStatus === 0 ? 'problem1' : getPrIdData.prHasProblem && getPrIdData.prStatus === 1 ? 'problem2' : 'normal'">
            {{ getPrIdData.prHasProblem && getPrIdData.prStatus === 0 ? 'Đang chờ xử lý' : getPrIdData.prHasProblem &&
              getPrIdData.prStatus === 1 ? 'Đang xử lý' : getPrIdData.prStatus === 2 ? 'Hoàn thành' : 'Không vấn đề gì' }}
          </div>
          <ion-card-title>Khu vực: {{ getPrIdData.areaName }}</ion-card-title>
          <ion-card-subtitle>Vị trí: {{ getPrIdData.cpName }}</ion-card-subtitle>
        </ion-card-header>

        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-label>
                <h2>Thời gian dự kiến: <strong>{{ getPrIdData.planHours ? `${getPrIdData.planHours} giờ` : '' }} {{
                  getPrIdData.planSeconds ? `${getPrIdData.planSeconds} giây` : '' }} {{ getPrIdData.planMinutes ?
                      `${getPrIdData.planMinutes} phút` : '' }}</strong></h2>
                <h3 :class="getPrIdData.timeProblem ? 'time-problem' : ''">Thời gian thực tế: {{
                  getPrIdData.realityHours ? `${getPrIdData.realityHours} giờ` : '' }} {{
                    getPrIdData.realityMinutes ? `${getPrIdData.realityMinutes} phút` : '' }} {{
                    getPrIdData.realitySeconds ? `${getPrIdData.realitySeconds} giây` : '' }}
                </h3>
              </ion-label>
            </ion-item>

            <ion-item>
              <ion-label>
                <h2>Người báo cáo: <strong>{{ getPrIdData.reportName }}</strong></h2>
                <h3>Ngày báo cáo: {{ formatDate(getPrIdData.reportAt) }}</h3>
              </ion-label>
            </ion-item>

            <ion-item v-if="getPrIdData.prHasProblem">
              <ion-label>
                <h2>Người cập nhật: <strong>{{ getPrIdData.updatedName }}</strong></h2>
                <h3>Ngày cập nhật: {{ formatDate(getPrIdData.updatedAt) }}</h3>
              </ion-label>
            </ion-item>

            <ion-item v-if="getPrIdData.cpDescription">
              <ion-label>
                <h3>Mô tả Checkpoint:</h3>
                <p class="description-text">{{ getPrIdData.cpDescription }}</p>
              </ion-label>
            </ion-item>

            <ion-item class="note-item">
              <ion-label>
                <h3>Ghi chú tổng:</h3>
                <div class="note-content">{{ getPrIdData.prNote || 'Không có ghi chú tổng' }}</div>
              </ion-label>
            </ion-item>
          </ion-list>

          <div v-if="listGroups.length > 0" class="groups-container">
            <h2 class="group-section-title">Hình ảnh báo cáo</h2>

            <div v-for="(group, index) in listGroups" :key="index" class="group-box">
              <div class="group-header">
                <ion-icon :icon="documentTextOutline" class="group-icon"></ion-icon>
                <span class="group-note-text">{{ group.note }}</span>
              </div>

              <ion-grid class="image-grid">
                <ion-row>
                  <ion-col v-for="(img, imgIndex) in group.images" :key="imgIndex" size="4" size-md="3">
                    <div class="thumbnail-wrapper" @click="openModal(img)">
                      <ion-img :src="img.url" class="thumb-img"></ion-img>
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </div>
          </div>

        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import router from '@/router';
import {
  IonHeader, IonToolbar, IonTitle, IonCard, IonCardHeader, IonCardTitle,
  IonCardSubtitle, IonCardContent, IonCol, IonGrid, IonRow, IonPage,
  IonContent, IonLabel, IonImg, IonModal, IonButtons, IonBackButton,
  IonSpinner, IonList, IonItem, IonIcon, IonButton
} from '@ionic/vue'
import { calendarOutline, documentTextOutline } from 'ionicons/icons';
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { Swiper, SwiperSlide } from 'swiper/vue';
import 'swiper/css';
import '@ionic/vue/css/ionic-swiper.css';

const store = useStore();

// State cho Modal ảnh
const isModalOpen = ref(false);
const currentSlideIndex = ref(0);

/**
 * Lấy data từ Store dựa trên ID từ URL
 * Sử dụng computed để tự động cập nhật nếu Store thay đổi
 */
const getPrIdData = computed(() => {
  const dataStoreRP = store.state.currentCheckpoint;

  // 1. Nếu Store rỗng, trả về null để hiện Loading
  if (!dataStoreRP) {
    return null;
  }

  // 2. Bóc tách lớp vỏ bọc bên ngoài
  let actualData = dataStoreRP?.data?.data || dataStoreRP?.data || dataStoreRP;

  // 3. XỬ LÝ QUAN TRỌNG: Nếu dữ liệu đang nằm trong một mảng, lấy phần tử đầu tiên ra
  if (Array.isArray(actualData)) {
    if (actualData.length > 0) {
      actualData = actualData[0]; // Lấy Object ở vị trí đầu tiên
    } else {
      return null; // Nếu mảng rỗng thì cũng coi như không có data
    }
  }

  console.log("Dữ liệu ĐÃ CHUẨN HOÁ thành Object:", actualData);

  // Trả về một Object chuẩn xác cho giao diện HTML đọc
  return actualData;
});

/**
 * Tự động chuyển đổi reportImages sang định dạng Base64 để hiển thị
 */
const listGroups = computed(() => {
  const data = getPrIdData.value;

  if (data && data.noteGroups && Array.isArray(data.noteGroups)) {
    return data.noteGroups.map((group: any) => {
      // Xử lý mảng ảnh bên trong từng group
      const processedImages = (group.reportImages || []).map((img: any) => {
        const base64String = img.priImage;
        const mimeType = img.priImageType || 'jpeg';

        const imageUrl = base64String.startsWith('data:image')
          ? base64String
          : `data:image/${mimeType};base64,${base64String}`;

        return { url: imageUrl, note: group.priImageNote };
      });

      return {
        note: group.priImageNote || 'Không có tiêu đề',
        images: processedImages
      };
    }).filter((group: any) => group.images.length > 0); // Chỉ lấy những group có ảnh
  }
  return [];
});

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const allImagesFlat = computed(() => {
  let flatArray: { url: string; note?: string }[] = [];
  listGroups.value.forEach((group: any) => {
    flatArray = [...flatArray, ...group.images];
  });
  return flatArray;
});

const openModal = (img: { url: string; note?: string }) => {
  // Tìm index của tấm hình này trong mảng tổng
  const index = allImagesFlat.value.findIndex(x => x.url === img.url);
  currentSlideIndex.value = index !== -1 ? index : 0;
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};
</script>

<style scoped>
.image-grid {
  padding: 10px;
}

.thumbnail-wrapper {
  aspect-ratio: 1/1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.status-badge {
  width: fit-content;
  display: inline-block;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.status-badge.normal {
  background: #d4fcc7;
  color: #1e4620;
}

.status-badge.problem1 {
  background: #ffdada;
  color: #7a1b1b;
}

.status-badge.problem2 {
  background: #FFB86A;
  color: #7a1b1b;
}

.note-content {
  background: #f4f5f8;
  padding: 12px;
  border-radius: 8px;
  margin-top: 8px;
  color: #444;
  font-style: italic;
  white-space: pre-wrap;
}

.description-text {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
}

.image-modal {
  --width: 100%;
  --height: 100%;
  --background: rgba(0, 0, 0, 0.9);
}

.modal-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
}

.modal-wrapper ion-img {
  max-width: 100%;
  max-height: 90vh;
}

h3 {
  font-weight: 600;
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 4px;
}

/* Style cho container chứa các nhóm */
.groups-container {
  margin-top: 20px;
  padding: 0 16px;
}

.group-section-title {
  font-size: 1.1rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 15px;
  border-bottom: 2px solid #eee;
  padding-bottom: 8px;
}

/* Style cho từng khối nhóm */
.group-box {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 15px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.group-header {
  background: #f8f9fa;
  padding: 10px 15px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #e0e0e0;
}

.group-icon {
  font-size: 1.2rem;
  color: #3880ff;
  /* Màu xanh Ionic */
  margin-right: 8px;
}

.group-note-text {
  font-weight: 600;
  color: #444;
  font-size: 0.95rem;
}

/* Xóa padding thừa của grid bên trong box */
.group-box .image-grid {
  padding: 10px;
}

/* CSS cho Modal và Swiper */
.image-modal {
  --width: 100%;
  --height: 100%;
  --background: rgba(0, 0, 0, 0.95);
  /* Làm nền đen sâu hơn một chút */
}

.modal-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.close-modal-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  font-weight: bold;
}

.swiper-slide-content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.slide-inner {
  width: 100%;
  text-align: center;
  padding: 20px;
}

.slide-inner ion-img {
  max-width: 100%;
  max-height: 80vh;
  /* Chừa không gian cho Text */
  object-fit: contain;
}

.image-caption {
  color: white;
  margin-top: 15px;
  font-size: 1.1rem;
  padding: 0 20px;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
}

.time-problem {
  color: red;
}
</style>