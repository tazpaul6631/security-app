<template>
    <ion-page>
        <ion-header>
            <ion-toolbar class="none-padding">
                <ion-buttons slot="start">
                    <ion-back-button default-href="/home"></ion-back-button>
                </ion-buttons>
                <ion-title>{{ $t('page.roles') }}</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
            <div v-if="isLoading" class="ion-text-center ion-margin-top">
                <ion-spinner name="crescent"></ion-spinner>
                <p>{{ $t('role.load-data') }}</p>
            </div>

            <ion-card v-for="role in displayedRoles" :key="role.roleId" class="role-card">
                <ion-card-header>
                    <ion-card-title class="role-title">
                        <div class="role-name-code" style="display: grid;">
                            <ion-label>{{ role.roleName }}</ion-label>
                            <ion-label>{{ role.roleCode }}</ion-label>
                        </div>
                        <div class="role-admin">
                            <ion-badge :color="role.roleIsAdmin ? 'success' : 'primary'" class="ion-float-right">
                                {{ role.roleIsAdmin ? 'Admin' : role.roleHourReport ? 'Hour Report' : '' }}
                            </ion-badge>
                        </div>
                    </ion-card-title>
                </ion-card-header>

                <div class="divider"></div>

                <ion-card-content>
                    <div class="info-row">
                        <strong>{{ $t('role.role-menu') }}</strong>
                        <div v-for="menu in role.roleMenus">
                            <ion-icon :icon="checkmarkDoneOutline" color="success"></ion-icon> {{ menu.mcName }} - {{
                                menu.mcCode }}
                        </div>
                    </div>
                    <div class="info-row">
                        <strong>{{ $t('role.created-date') }}</strong> {{ formatDate(role.createdAt) }}
                    </div>
                    <div class="info-row">
                        <strong>{{ $t('role.updated-date') }}</strong> {{ formatDate(role.updatedAt) }}
                    </div>
                </ion-card-content>
            </ion-card>

            <div v-if="!isLoading && displayedRoles.length === 0" class="ion-text-center ion-margin-top">
                <p>{{ $t('role.no-role-data') }}</p>
            </div>

            <ion-infinite-scroll @ionInfinite="loadMoreRoles" :disabled="isAllLoaded">
                <ion-infinite-scroll-content loading-spinner="bubbles" :loading-text="$t('role.loading-more')">
                </ion-infinite-scroll-content>
            </ion-infinite-scroll>

        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import {
    IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonIcon, IonLabel,
    IonCardContent, IonBadge, IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent
} from '@ionic/vue';

// Import file api của bạn (điều chỉnh đường dẫn cho đúng với project)
import Role from '@/api/Role';
import { checkmarkDoneOutline } from 'ionicons/icons';

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

        console.log(result);

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

// Sự kiện được gọi khi cuộn xuống cuối trang
const loadMoreRoles = (event: any) => {
    // Dùng setTimeout nhỏ để tạo cảm giác mượt mà khi hiện loading spinner
    setTimeout(() => {
        loadNextBatch();
        event.target.complete(); // Thông báo cho Ionic biết đã load xong để ẩn spinner
    }, 500);
};

// --- LIFECYCLE ---
onMounted(() => {
    fetchRoles(); // Tự động gọi API khi vào page
});

</script>

<style scoped>
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

.ion-float-right {
    color: white;
}

.info-row {
    margin-bottom: 6px;
    font-size: 0.95rem;
}

.divider {
    height: 1px;
    background: #f1f5f9;
}
</style>