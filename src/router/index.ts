import { createRouter, createWebHashHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import store from '@/composables/useVuex';

// THÊM MỚI Ở ĐÂY: Import sẵn toàn bộ các Component (Eager Load) 
// để tránh lỗi "Failed to fetch dynamically imported module" khi test Offline
import Nav from '@/components/Nav.vue';
import HomePage from '@/views/HomePage.vue';
import CPDetail from '@/views/Area/AreaDetail.vue';
import CPCreate from '@/views/Area/AreaCreate.vue';
import Login from '@/views/Login/Login.vue';
import AreaBase from '@/views/Area/AreaIndex.vue';
import UserIndex from '@/views/User/UserIndex.vue';
import RoleIndex from '@/views/Role/RoleIndex.vue';
import ReportIndex from '@/views/Report/ReportIndex.vue';
import RouteIndex from '@/views/Route/RouteIndex.vue';
import TutorialIndex from '@/views/Tutorial/TutorialIndex.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    component: Nav,
    meta: { requiresAuth: true },
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'home',
        component: HomePage,
      },
      {
        path: 'checkpoint/detail/:id',
        name: 'checkpoint-detail',
        component: CPDetail,
        props: true,
      },
      {
        path: 'checkpoint/create',
        name: 'checkpoint-create',
        component: CPCreate,
        props: true,
      },
      {
        path: 'area',
        name: 'area',
        component: AreaBase,
      },
      {
        path: 'user',
        name: 'user',
        component: UserIndex,
      },
      {
        path: 'role',
        name: 'role',
        component: RoleIndex,
      },
      {
        path: 'route',
        name: 'route',
        component: RouteIndex,
      },
      {
        path: 'report',
        name: 'report',
        component: ReportIndex,
      },
      {
        path: 'tutorial',
        name: 'tutorial',
        component: TutorialIndex,
      },
    ]
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: to => {
      return store.state.token ? '/home' : '/login';
    }
  }
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to, from, next) => {
  // 1. HYDRATE THÔNG MINH: 
  // Chỉ chạy initApp nếu chưa hydrated VÀ không phải trang login
  // Thêm kiểm tra token để tránh việc gọi initApp thừa thãi khi chưa đăng nhập
  if (!store.state.isHydrated && to.name !== 'login') {
    // Nếu app chưa được nạp dữ liệu từ SQLite, nạp ngay
    await store.dispatch('initApp');
  }

  const token = store.state.token;
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  // 2. CHỐNG REDIRECT VÒNG LẶP:
  // Nếu đang ở Home mà có sự kiện mạng làm re-check, đừng redirect lại nếu token vẫn còn
  if (requiresAuth && !token) {
    return next({ name: 'login' });
  }

  if (to.name === 'login' && token) {
    return next({ name: 'home' });
  }

  // 3. XỬ LÝ TRƯỜNG HỢP CHUYỂN MẠNG:
  // Nếu mạng khôi phục khi đang ở giữa các trang, next() ngay lập tức 
  // để tránh việc Router bị treo bởi các tiến trình async khác của Store
  next();
});

export default router;