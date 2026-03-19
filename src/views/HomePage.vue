<template>
  <ion-page>
    <ion-content class="custom-bg">
      <div v-show="dataUser && !store.state.isSyncingOffline" class="dashboard-container">
        <div class="profile-card">
          <div class="info-row">
            <div class="icon-wrapper">
              <ion-icon :icon="person" class="dark-icon" :class="isOnline ? 'color-green' : 'color-red'"></ion-icon>
              <span class="status-dot" :class="isOnline ? 'online' : 'offline'"></span>
            </div>
            <div class="text-content">
              <h3>{{ dataUser?.userName }}</h3>
              <div class="text-code-roleName">
                <p class="mr-code">{{ dataUser?.userCode }}</p> - <p class="badge-it ml-roleName">{{
                  dataUser?.userRoleName }}</p>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="info-row">
            <div class="icon-wrapper">
              <ion-icon :icon="location" class="dark-icon color-red"></ion-icon>
            </div>
            <div class="text-content">
              <h3>{{ dataUser?.userAreaCode }}</h3>
              <p>{{ dataUser?.userAreaName }}</p>
            </div>
          </div>
        </div>

        <ion-grid>
          <ion-row>
            <ion-col v-for="item in allowViews" :key="item.mcId" size="4" size-md="2">
              <div :button="true" v-if="item.roleId" class="menu-item" @click="handleClickIcon(item.mcId)">
                <ion-icon :icon="getRoleData(item.mcId).icon" class="menu-icon" :class="getRoleData(item.mcId).color">
                </ion-icon>
                <span class="text-mcName">{{ item.mcName }}</span>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>
      </div>

      <div v-show="!dataUser && store.state.isSyncingOffline" class="loading-state">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Đang tải thông tin cá nhân...</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import router from '@/router';
import { IonPage, IonContent, IonIcon, IonGrid, IonRow, IonCol, IonSpinner } from '@ionic/vue';
import {
  person, location, personCircle, people, barChartOutline, footstepsOutline, alertCircleOutline
} from 'ionicons/icons';
import { computed, ref } from 'vue';
import { useStore } from 'vuex';

const isOnline = computed(() => store.state.isOnline);
const store = useStore();
// Lấy dataUser từ Vuex, nếu không có sẽ hiển thị giá trị mặc định trong template
const dataUser = computed(() => store.state.dataUser);
const allowViews = computed(() => dataUser.value?.allowViews || []);
console.log(dataUser);

const listRoles = ref([
  { mcId: 1, icon: `${personCircle}`, color: 'color-orange', router: '/role' },
  { mcId: 2, icon: `${people}`, color: 'color-slate', router: '/user' },
  { mcId: 3, icon: `${location}`, color: 'color-red', router: '/area' },
  { mcId: 4, icon: `${footstepsOutline}`, color: 'color-gold', router: '/route' },
  { mcId: 5, icon: `${barChartOutline}`, color: 'color-blue', router: '/report' },
  { mcId: 6, icon: `${alertCircleOutline}`, color: 'color-grey', router: '/tutorial' },
])

const getRoleData = (mcId: number) => {
  const role = listRoles.value.find(r => r.mcId === mcId);
  return role ? role : { icon: '', color: '', router: '' };
};

const handleClickIcon = (id: number) => {
  const role = getRoleData(id);
  // Chỉ chuyển trang nếu tìm thấy router hợp lệ
  if (role && role.router) {
    router.replace({ path: role.router });
  } else {
    console.warn("Không tìm thấy đường dẫn cho mcId:", id);
  }
};
</script>

<style scoped>
ion-col {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

/* Sửa lại icon-wrapper hiện tại (Chỉ cần thêm position: relative) */
.icon-wrapper {
  position: relative;
  /* <-- Thêm dòng này */
  background: #f4f6f8;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-right: 12px;
}

/* Thêm các class mới cho chấm trạng thái */
.status-dot {
  position: absolute;
  bottom: 0px;
  /* Nằm sát góc dưới */
  right: 0px;
  /* Nằm sát góc phải */
  width: 12px;
  /* Kích thước chấm */
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  /* Tạo viền trắng để tách biệt với nền */
}

/* Màu khi Online (Xanh lá) */
.status-dot.online {
  background-color: #10b981;
}

/* Màu khi Offline (Xám) */
.status-dot.offline {
  background-color: #fc1a0a;
}

/* Màu nền tổng thể giống hình */
.custom-bg {
  --background: #eef1f6;
}

.dashboard-container {
  padding: 16px;
}

/* --- Style cho Profile Card --- */
.profile-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
  margin-bottom: 24px;
}

.info-row {
  display: flex;
  align-items: center;
}

.icon-wrapper {
  background: #f4f6f8;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-right: 12px;
}

.dark-icon {
  font-size: 20px;
  color: #1c2434;
}

.text-content {
  flex: 1;
}

.text-content h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1c2434;
}

.text-content p {
  margin: 2px 0 0 0;
  font-size: 13px;
  color: #64748b;
}

.text-code-roleName {
  display: flex;
  align-items: center;
}

.mr-code {
  margin-right: 5px !important;
}

.ml-roleName {
  margin-left: 5px !important;
}

.text-mcName {
  font-size: 14px !important;
}

.badge-it {
  background: #f3e8ff;
  color: #7c3aed;
  font-size: 12px;
  font-weight: bold;
  padding: 4px 10px;
  border-radius: 8px;
}

.divider {
  height: 1px;
  background: #f1f5f9;
  margin: 16px 0;
}

/* --- Style cho Menu Grid --- */
.menu-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  row-gap: 24px;
  column-gap: 8px;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
}

.menu-icon {
  font-size: 50px;
  margin-bottom: 8px;
}

.menu-item span {
  font-size: 12px;
  color: #1c2434;
  line-height: 1.2;
}

/* Màu sắc của các icon menu */
.color-orange {
  color: #f97316;
}

.color-slate {
  color: #475569;
}

.color-green {
  color: #10b981;
}

.color-red {
  color: #ef4444;
}

.color-blue {
  color: #0ea5e9;
}

.color-gold {
  color: #FFD230;
}

.color-grey {
  color: #62748E;
}

/* Thêm vào cuối phần style của bạn */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80%;
  color: #64748b;
}

.loading-state p {
  margin-top: 10px;
  font-size: 14px;
}
</style>