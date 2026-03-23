<template>
    <ion-page>
        <ion-header>
            <ion-toolbar class="none-padding">
                <ion-buttons slot="start">
                    <ion-back-button default-href="/home"></ion-back-button>
                </ion-buttons>
                <ion-title>
                    Users
                </ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
            <div v-if="isLoading" class="ion-text-center ion-margin-top">
                <ion-spinner name="crescent"></ion-spinner>
                <p>Đang tải dữ liệu...</p>
            </div>

            <ion-card v-for="user in displayedUsers" :key="user.userId" class="user-card">
                <ion-card-header>
                    <div class="info-row">
                        <div class="icon-wrapper" :style="{ backgroundColor: getRoleColor(user.userRoleId).bg }">
                            <ion-icon :icon="person" class="dark-icon"
                                :style="{ color: getRoleColor(user.userRoleId).color }"></ion-icon>
                        </div>
                        <div class="text-content">
                            <ion-card-title class="user-title padding-text">
                                <span>{{ user.userName }}</span>
                            </ion-card-title>
                            <ion-card-title class="user-title padding-text">
                                <span>{{ user.userCode }}</span>
                            </ion-card-title>
                            <ion-card-subtitle class="padding-text text-code-roleName">
                                <p class="badge-it"
                                    :style="{ backgroundColor: getRoleColor(user.userRoleId).bg, color: getRoleColor(user.userRoleId).color }">
                                    {{ user.userRoleName }}
                                </p> - {{ user.userRoleCode }}
                            </ion-card-subtitle>
                            <ion-card-subtitle class="padding-text">{{ user.userAreaName }} - {{ user.userAreaCode
                            }}</ion-card-subtitle>
                        </div>
                    </div>
                </ion-card-header>
            </ion-card>

            <div v-if="!isLoading && displayedUsers.length === 0" class="ion-text-center ion-margin-top">
                <p>Không có dữ liệu User.</p>
            </div>

            <ion-infinite-scroll @ionInfinite="loadMoreRoles" :disabled="isAllLoaded">
                <ion-infinite-scroll-content loading-spinner="bubbles" loading-text="Đang tải thêm dữ liệu...">
                </ion-infinite-scroll-content>
            </ion-infinite-scroll>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import {
    IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle,
    IonIcon, IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent
} from '@ionic/vue';
import UserView from '@/api/UserView';
import { person } from 'ionicons/icons';

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
// Gọi API lấy dữ liệu
const fetchUsers = async () => {
    try {
        isLoading.value = true;

        // Gọi hàm API của bạn
        const response = await UserView.postUserView();

        // Lấy data thực sự từ response của Axios
        const result = response.data;

        console.log(result);
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
    fetchUsers(); // Tự động gọi API khi vào page
});

</script>

<style scoped>
/* --- Style cho Card tổng thể --- */
.user-card {
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

/* Bỏ padding mặc định của header để tự custom */
ion-card-header {
    padding: 16px;
}

/* --- Layout dòng thông tin --- */
.info-row {
    display: flex;
    align-items: center;
    gap: 16px;
}

/* --- Avatar / Icon Wrapper --- */
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
    gap: 4px;
}

/* Tên User */
.user-title:first-child span {
    font-size: 1.1rem;
    font-weight: 700;
    color: #1f2937;
    letter-spacing: -0.02em;
}

/* Mã User */
.user-title:nth-child(2) span {
    font-size: 0.85rem;
    font-weight: 500;
    color: #6b7280;
}

/* Reset margin/padding của Ionic subtitle */
ion-card-subtitle {
    margin: 0;
    color: #4b5563;
}

/* --- Cụm Role Name & Code --- */
.text-code-roleName {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 0.85rem;
    margin-top: 2px;
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

/* --- Khu vực / Area --- */
.text-content ion-card-subtitle:last-child {
    font-size: 0.8rem;
    color: #9ca3af;
    display: flex;
    align-items: center;
    margin-top: 2px;
}
</style>