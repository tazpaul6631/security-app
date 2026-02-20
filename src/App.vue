<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSQLite } from '@/composables/useSQLite';
import { Network } from '@capacitor/network';

const { initDatabase, checkAuthStatus } = useSQLite();
const router = useRouter();

const isLoading = ref(true);

// onMounted(async () => {
//   try {
//     // 1. Khởi tạo DB (Bắt buộc phải xong mới làm việc khác)
//     await initDatabase();

//     // 2. Lấy trạng thái mạng và phiên đăng nhập cùng lúc để tiết kiệm thời gian
//     const [status, session] = await Promise.all([
//       Network.getStatus(),
//       checkAuthStatus()
//     ]);

//     if (session) {
//       // TRƯỜNG HỢP 1: Đã login trước đó
//       console.log('Chào mừng trở lại, Thuận!');
//       router.push('/home');
//     } else {
//       // TRƯỜNG HỢP 2: Chưa có dữ liệu login trong SQLite
//       if (status.connected) {
//         router.push('/login');
//       } else {
//         // Thông báo lỗi nếu là lần đầu mà không có mạng
//         alert('Cần kết nối mạng để khởi tạo ứng dụng lần đầu.');
//       }
//     }
//   } catch (error) {
//     console.error("Lỗi hệ thống khởi động:", error);
//   } finally {
//     isLoading.value = false;
//   }
// });

</script>
