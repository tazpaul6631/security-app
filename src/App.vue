<template>
  <ion-app>
    <div v-if="!isAppReady" class="app-loading">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Đang chuẩn bị dữ liệu an ninh...</p>
    </div>

    <ion-router-outlet v-else />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonSpinner } from '@ionic/vue';
import { onMounted, ref, onUnmounted } from 'vue';
import { useSQLite } from '@/composables/useSQLite';
import store from '@/composables/useVuex';
import { Network } from '@capacitor/network';
import type { PluginListenerHandle } from '@capacitor/core';
import { useOfflineManager } from '@/composables/useOfflineManager';

const { syncData } = useOfflineManager();
const { initDatabase } = useSQLite();
const isAppReady = ref(false);

// Biến để lưu vết trạng thái mạng trước đó, tránh gọi sync trùng lặp
let lastNetworkStatus: boolean | null = null;
let networkHandler: PluginListenerHandle | null = null;

onMounted(async () => {
  try {
    await initDatabase();

    // 1. Chỉ khôi phục Token/User trước để biết có cần chạy initApp sâu hơn không
    await Promise.all([
      store.dispatch('restoreToken'),
      store.dispatch('restoreUser')
    ]);

    // 2. Lấy trạng thái mạng hiện tại và GÁN NGAY vào biến chặn
    const status = await Network.getStatus();
    lastNetworkStatus = status.connected;
    store.commit('SET_NETWORK_STATUS', status.connected);

    // 3. Nếu đã đăng nhập, mới khởi tạo toàn bộ dữ liệu offline
    if (store.state.token) {
      await store.dispatch('initApp');

      // Chỉ đồng bộ nếu ĐANG online và CÓ dữ liệu chờ
      if (status.connected) {
        syncData();
      }
    }
  } finally {
    isAppReady.value = true;
  }

  // 4. Lắng nghe thay đổi (Sử dụng flag lastNetworkStatus để chặn)
  networkHandler = await Network.addListener('networkStatusChange', status => {
    // QUAN TRỌNG: Chỉ xử lý nếu trạng thái THỰC SỰ thay đổi (ví dụ: đang lướt mạng thì mất, hoặc đang mất thì có lại)
    if (status.connected === lastNetworkStatus) return;

    const isComingOnline = status.connected && lastNetworkStatus === false;

    store.commit('SET_NETWORK_STATUS', status.connected);
    lastNetworkStatus = status.connected;

    if (isComingOnline && store.state.token) {
      console.log("Mạng vừa khôi phục, chuẩn bị đồng bộ...");
      syncData();
    }
  });
});

onUnmounted(async () => {
  if (networkHandler) {
    await networkHandler.remove();
  }
});
</script>

<style scoped>
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f4f4f4;
}

.app-loading p {
  margin-top: 15px;
  color: #666;
  font-weight: 500;
}
</style>