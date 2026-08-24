<template>
  <div class="user-page">
    <header class="route-header">
      <button type="button" class="route-back-btn" :aria-label="$t('routes.go-home')" @click="router.replace('/home')">
        <i class="pi pi-arrow-left route-back-icon" aria-hidden="true" />
        <span class="route-title">{{ $t('page.users') }}</span>
      </button>
    </header>

    <AppPageContent class="user-content">
      <div class="user-bg" aria-hidden="true">
        <span class="user-blob user-blob-green" />
        <span class="user-blob user-blob-purple" />
      </div>

      <div ref="userBodyRef" class="user-body">
        <div v-if="isLoading" class="list-status">
          <ProgressSpinner stroke-width="2" />
          <p>{{ $t('users.loading') }}</p>
        </div>

        <Card v-for="user in displayedUsers" :key="user.userId" class="user-card"
          :pt="{ body: { class: 'user-card-body' }, content: { class: 'user-card-content' } }">
          <template #content>
            <div class="info-row">
              <div class="user-code-row">
                <p class="user-title user-code-text">{{ user.userCode }}</p>
                <div class="icon-wrapper" :style="{ backgroundColor: getRoleColor(user.userRoleId).bg }">
                  <i class="pi pi-user dark-icon" :style="{ color: getRoleColor(user.userRoleId).color }" />
                </div>
              </div>
              <div class="text-content">
                <p class="user-title user-name-text">{{ user.userName }}</p>
                <div class="text-code-roleName">
                  <p class="badge-it"
                    :style="{ backgroundColor: getRoleColor(user.userRoleId).bg, color: getRoleColor(user.userRoleId).color }">
                    {{ user.userRoleName }}
                  </p>
                  <span> - {{ user.userRoleCode }}</span>
                </div>
                <p class="user-area-text">{{ user.userAreaName }} - {{ user.userAreaCode }}</p>
              </div>
            </div>
          </template>
        </Card>

        <div v-if="!isLoading && displayedUsers.length === 0" class="list-status">
          <p>{{ $t('users.no-data') }}</p>
        </div>

        <div v-if="!isAllLoaded" ref="sentinelRef" class="infinite-sentinel">
          <ProgressSpinner stroke-width="4" style="width: 28px; height: 28px" />
          <span>{{ $t('users.loading-more') }}</span>
        </div>
      </div>
    </AppPageContent>
  </div>
</template>

<script setup lang="ts">
import router from '@/router';
import { ref, onMounted, computed } from 'vue';
import AppPageContent from '@/components/AppPageContent.vue';
import { useHardwareBackButton } from '@/composables/useHardwareBackButton';
import { useInfiniteScroll } from '@/composables/useInfiniteScroll';
import UserView from '@/api/UserView';
import { Card, ProgressSpinner } from '@/plugins/primevue.components';

// --- MẢNG MÀU ĐỊNH SẴN ---
const colorPalettes = [
  { bg: '#dcfce7', color: '#16a34a' }, // 1: Xanh lá
  { bg: '#e0f2fe', color: '#0284c7' }, // 2: Xanh dương
  { bg: '#ffedd5', color: '#ea580c' }, // 3: Cam
  { bg: '#f3f4f6', color: '#4b5563' }  // 4: Xám
];

// --- HÀM LẤY MÀU THEO ROLE ID ---
const getRoleColor = (roleId: any) => {
  if (!roleId) return colorPalettes[0]; // Mặc định nếu không có roleId

  let index = 0;

  if (typeof roleId === 'number') {
    // Tự động xoay vòng màu khi ID vượt qua độ dài của mảng
    index = roleId % colorPalettes.length;
  }

  else {
    let hash = 0;
    for (let i = 0; i < String(roleId).length; i++) {
      hash = String(roleId).charCodeAt(i) + ((hash << 5) - hash);
    }
    index = Math.abs(hash) % colorPalettes.length;
  }

  return colorPalettes[index];
};

// --- STATE ---
const allUsers = ref<any[]>([]); // Lưu toàn bộ data từ API
const displayedUsers = ref<any[]>([]); // Data dùng để render trên màn hình (mỗi lần 5 item)
const isLoading = ref(true);

const itemsPerPage = 5; // Tải 5 items mỗi lần
let currentIndex = 0; // Vị trí index hiện tại để cắt mảng

// --- COMPUTED ---
// Kiểm tra xem đã load hết toàn bộ danh sách chưa để disable infinite scroll
const isAllLoaded = computed(() => {
  return displayedUsers.value.length >= allUsers.value.length;
});

// --- METHODS ---
const fetchUsers = async () => {
  try {
    isLoading.value = true;

    // Gọi hàm API của bạn
    const response = await UserView.postUserView();

    // Lấy data thực sự từ response của Axios
    const result = response.data;

    // Kiểm tra trên object result thay vì response
    if (result && result.success) {
      allUsers.value = result.data; // Gán toàn bộ data
      loadNextBatch(); // Load 5 item đầu tiên
    } else {
      console.error('API Error:', result?.message);
    }
  } catch (error) {
    console.error('Lỗi khi fetch User:', error);
  } finally {
    isLoading.value = false;
  }
};

// Hàm cắt 5 items tiếp theo đưa vào mảng hiển thị
const loadNextBatch = () => {
  const nextItems = allUsers.value.slice(currentIndex, currentIndex + itemsPerPage);
  displayedUsers.value.push(...nextItems);
  currentIndex += itemsPerPage;
};

const loadMoreUsers = async () => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  loadNextBatch();
};

const userBodyRef = ref<HTMLElement | null>(null);
const { sentinelRef } = useInfiniteScroll(isAllLoaded, loadMoreUsers, userBodyRef);

useHardwareBackButton(10, () => {
  router.replace('/home');
});

// --- LIFECYCLE ---
onMounted(() => {
  fetchUsers(); // Tự động gọi API khi vào page
});
</script>

<style scoped>
.user-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.route-header {
  min-height: 48px;
  padding: 4px 8px 4px 4px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.route-back-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 8px;
  min-height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 10px;
  text-align: left;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
  font: inherit;
}

.route-back-btn:hover,
.route-back-btn:focus,
.route-back-btn:focus-visible,
.route-back-btn:active {
  background: transparent;
  outline: none;
  box-shadow: none;
}

.route-back-icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: #334155;
}

.route-title {
  flex: 1;
  min-width: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.user-content {
  padding: 16px;
  height: 100%;
}

.list-status {
  text-align: center;
  margin-top: 16px;
  color: #64748b;
}

.infinite-sentinel {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  color: #64748b;
  font-size: 0.85rem;
}

.user-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.user-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  -webkit-filter: blur(40px);
  opacity: 0.9;
}

.user-blob-green {
  width: 250px;
  height: 250px;
  background: #e3f7ac;
  top: 20%;
  right: -50px;
}

.user-blob-purple {
  width: 250px;
  height: 250px;
  background: #cac2e9;
  bottom: 10%;
  left: -80px;
}

.user-body {
  position: relative;
  z-index: 1;
  height: 95%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* --- Style cho Card tổng thể --- */
.user-card {
  margin-bottom: 12px;
  border-radius: 16px;
  background: #ffffff;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* Hiệu ứng khi nhấn/hover (nếu dùng trên web) */
.user-card:active {
  transform: scale(0.98);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.user-card :deep(.user-card-body) {
  padding: 10px;
}

/* --- Layout dòng thông tin --- */
.info-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* --- Avatar / Icon Wrapper --- */
.user-code-row {
  display: flex;
  align-items: center;
  flex-direction: column;
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.5), 0 2px 6px rgba(0, 0, 0, 0.06);
}

.dark-icon {
  font-size: 28px;
}

/* --- Nội dung Text --- */
.text-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.user-title {
  margin: 0;
}

.user-name-text {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: -0.02em;
}

.user-code-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: #6b7280;
}

.user-area-text {
  margin: 0;
  font-size: 0.8rem;
  color: #9ca3af;
}

/* --- Cụm Role Name & Code --- */
.text-code-roleName {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.85rem;
}

/* Badge của Role (Hạt đậu) */
.badge-it {
  margin: 0;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
</style>