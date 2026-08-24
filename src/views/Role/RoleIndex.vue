<template>
  <div class="role-page">
    <header class="route-header">
      <button type="button" class="route-back-btn" :aria-label="$t('routes.go-home')" @click="router.replace('/home')">
        <i class="pi pi-arrow-left route-back-icon" aria-hidden="true" />
        <span class="route-title">{{ $t('page.roles') }}</span>
      </button>
    </header>

    <AppPageContent class="role-content">
      <div class="role-bg" aria-hidden="true">
        <span class="role-blob role-blob-green" />
        <span class="role-blob role-blob-purple" />
      </div>

      <div class="role-body">
        <div v-if="isLoading" class="list-status">
          <ProgressSpinner stroke-width="2" />
          <p>{{ $t('role.load-data') }}</p>
        </div>

        <Card v-for="role in displayedRoles" :key="role.roleId" class="role-card"
          :pt="{ body: { class: 'role-card-body' }, content: { class: 'role-card-content' } }">
          <template #title>
            <div class="role-title">
              <div class="role-name-code">
                <span>{{ role.roleName }}</span>
                <span>{{ role.roleCode }}</span>
              </div>
              <div v-if="role.roleIsAdmin || role.roleHourReport" class="role-admin">
                <Tag :value="role.roleIsAdmin ? 'Admin' : 'Hour Report'"
                  :severity="role.roleIsAdmin ? 'success' : 'info'" />
              </div>
            </div>
          </template>
          <template #content>
            <div class="divider"></div>
            <div class="info-row">
              <strong>{{ $t('role.role-menu') }}</strong>
              <div v-for="menu in role.roleMenus" :key="menu.mcId || menu.mcCode">
                <i class="pi pi-check-circle menu-check" /> {{ menu.mcName }} - {{ menu.mcCode }}
              </div>
            </div>
            <!-- <div class="info-row">
              <strong>{{ $t('role.created-date') }}</strong> {{ formatDate(role.createdAt) }}
            </div>
            <div class="info-row">
              <strong>{{ $t('role.updated-date') }}</strong> {{ formatDate(role.updatedAt) }}
            </div> -->
          </template>
        </Card>

        <div v-if="!isLoading && displayedRoles.length === 0" class="list-status">
          <p>{{ $t('role.no-role-data') }}</p>
        </div>

        <div v-if="!isAllLoaded" ref="sentinelRef" class="infinite-sentinel">
          <ProgressSpinner stroke-width="4" style="width: 28px; height: 28px" />
          <span>{{ $t('role.loading-more') }}</span>
        </div>
      </div>
    </AppPageContent>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AppPageContent from '@/components/AppPageContent.vue';
import { useHardwareBackButton } from '@/composables/useHardwareBackButton';
import { useInfiniteScroll } from '@/composables/useInfiniteScroll';
import router from '@/router';
import Role from '@/api/Role';
import { Card, ProgressSpinner, Tag } from '@/plugins/primevue.components';

// --- STATE ---
const allRoles = ref<any[]>([]); // Lưu toàn bộ data từ API
const displayedRoles = ref<any[]>([]); // Data dùng để render trên màn hình (mỗi lần 5 item)
const isLoading = ref(true);

const itemsPerPage = 5; // Tải 5 items mỗi lần
let currentIndex = 0; // Vị trí index hiện tại để cắt mảng

// --- COMPUTED ---
// Kiểm tra xem đã load hết toàn bộ danh sách chưa để disable infinite scroll
const isAllLoaded = computed(() => {
  return displayedRoles.value.length >= allRoles.value.length;
});

// --- METHODS ---
// Format ngày tháng hiển thị đẹp hơn
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// Gọi API lấy dữ liệu
const fetchRoles = async () => {
  try {
    isLoading.value = true;

    // Gọi hàm API của bạn
    const response = await Role.postRole();

    // Lấy data thực sự từ response của Axios
    const result = response.data;

    // Kiểm tra trên object result thay vì response
    if (result && result.success) {
      allRoles.value = result.data; // Gán toàn bộ data
      loadNextBatch(); // Load 5 item đầu tiên
    } else {
      console.error('API Error:', result?.message);
    }
  } catch (error) {
    console.error('Lỗi khi fetch Role:', error);
  } finally {
    isLoading.value = false;
  }
};

// Hàm cắt 5 items tiếp theo đưa vào mảng hiển thị
const loadNextBatch = () => {
  const nextItems = allRoles.value.slice(currentIndex, currentIndex + itemsPerPage);
  displayedRoles.value.push(...nextItems);
  currentIndex += itemsPerPage;
};

const loadMoreRoles = async () => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  loadNextBatch();
};

const { sentinelRef } = useInfiniteScroll(isAllLoaded, loadMoreRoles);

useHardwareBackButton(10, () => {
  router.replace('/home');
});

// --- LIFECYCLE ---
onMounted(() => {
  fetchRoles(); // Tự động gọi API khi vào page
});
</script>

<style scoped>
.role-page {
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

.role-content {
  padding: 16px;
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
  gap: 8px;
  padding: 12px 0;
  color: #64748b;
  font-size: 0.85rem;
}

.role-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.role-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  -webkit-filter: blur(40px);
  opacity: 0.9;
}

.role-blob-green {
  width: 250px;
  height: 250px;
  background: #e3f7ac;
  top: 20%;
  right: -50px;
}

.role-blob-purple {
  width: 250px;
  height: 250px;
  background: #cac2e9;
  bottom: 10%;
  left: -80px;
}

.role-body {
  position: relative;
  z-index: 1;
}

.role-card {
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.role-title {
  font-size: 1.2rem;
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.role-name-code {
  display: grid;
}

.menu-check {
  color: #16a34a;
  margin-right: 4px;
}

.info-row {
  margin-bottom: 6px;
  font-size: 0.95rem;
  display: flex;
  gap: 8px;
  flex-direction: column;
}

.divider {
  height: 1px;
  background: #f1f5f9;
}
</style>