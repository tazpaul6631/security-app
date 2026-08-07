<template>
  <ion-page>
    <ion-content class="home-content">
      <div class="home-bg" aria-hidden="true">
        <span class="home-blob home-blob-green" />
        <span class="home-blob home-blob-purple" />
      </div>

      <div v-show="dataUser && !store.state.isSyncingOffline" class="dashboard-container">
        <Card class="profile-card"
          :pt="{ body: { class: 'profile-card-body' }, content: { class: 'profile-card-content' } }">
          <template #content>
            <div class="info-row">
              <div class="icon-wrapper">
                <i class="pi pi-user profile-icon" />
                <span class="status-dot" :class="isOnline ? 'online' : 'offline'" />
              </div>
              <div class="text-content">
                <h3 class="user-name">{{ dataUser?.userName }}</h3>
                <div v-if="dataUser" class="text-code-role">
                  <span class="user-code">{{ dataUser.userCode }}</span>
                  <Tag :value="$t(getRoleData(dataUser.userRoleId).name)" class="role-tag" />
                </div>
              </div>
            </div>

            <Divider class="profile-divider" />

            <div class="info-row">
              <div class="icon-wrapper icon-wrapper-area">
                <i class="pi pi-map-marker profile-icon area-icon" />
              </div>
              <div class="text-content">
                <h3 class="user-name">{{ dataUser?.userAreaCode }}</h3>
                <p class="area-name">{{ dataUser?.userAreaName }}</p>
              </div>

              <OfflineSyncHeaderButton :count="syncBadgeCount" @click="isOfflineSyncModalOpen = true" />
            </div>
          </template>
        </Card>

        <div class="menu-grid">
          <button v-for="item in allowViews" :key="item.mcId" v-show="item.roleId" type="button" class="menu-tile"
            @click="handleClickIcon(item.mcId)">
            <span class="menu-icon-wrap" :class="getAreaData(item.mcId).color">
              <i :class="['pi', getAreaData(item.mcId).icon, 'menu-icon']" />
            </span>
            <span class="menu-label">{{ $t(getAreaData(item.mcId).name) }}</span>
          </button>
        </div>
      </div>

      <div v-show="!dataUser && store.state.isSyncingOffline" class="loading-state">
        <ProgressSpinner stroke-width="2" />
        <p>{{ $t('home.info-areas') }}</p>
      </div>

      <OfflineSyncModal v-model:visible="isOfflineSyncModalOpen" :get-checkpoint-name="resolveCheckpointName" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import router from '@/router';
import { IonPage, IonContent, onIonViewWillEnter } from '@ionic/vue';
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { Card, Divider, ProgressSpinner, Tag } from '@/plugins/primevue.components';
import OfflineSyncHeaderButton from '@/components/OfflineSyncHeaderButton.vue';
import OfflineSyncModal from '@/components/OfflineSyncModal.vue';
import { useSyncBadgeCount } from '@/composables/useOfflineSyncDisplay';

const isOfflineSyncModalOpen = ref(false);
const { syncBadgeCount, loadPendingItems } = useSyncBadgeCount();
const store = useStore();
const { t } = useI18n();
const isOnline = computed(() => store.state.isOnline);
const dataUser = computed(() => store.state.dataUser);
const allowViews = computed(() => dataUser.value?.allowViews || []);

const listAreas = ref([
  { mcId: 1, icon: 'pi-id-card', name: 'home.roles', color: 'tone-orange', router: '/role' },
  { mcId: 2, icon: 'pi-users', name: 'home.users', color: 'tone-slate', router: '/user' },
  { mcId: 3, icon: 'pi-map-marker', name: 'home.areas', color: 'tone-red', router: '/area' },
  { mcId: 4, icon: 'pi-map', name: 'home.routes', color: 'tone-gold', router: '/route' },
  { mcId: 5, icon: 'pi-chart-bar', name: 'home.reports', color: 'tone-blue', router: '/report' },
  { mcId: 6, icon: 'pi-book', name: 'home.tutorial', color: 'tone-grey', router: '/tutorial' },
]);

const listRoles = ref([
  { roleId: 1, name: 'home.adm' },
  { roleId: 2, name: 'home.it' },
  { roleId: 3, name: 'home.expat' },
  { roleId: 4, name: 'home.security' },
]);

const getAreaData = (mcId: number) => {
  return listAreas.value.find((r) => r.mcId === mcId) ?? { icon: '', color: '', router: '', name: '' };
};

const getRoleData = (userRoleId: number) => {
  return listRoles.value.find((r) => r.roleId === userRoleId) ?? { name: '' };
};

const handleClickIcon = (id: number) => {
  const area = getAreaData(id);
  if (area?.router) {
    router.replace({ path: area.router });
  }
};

const resolveCheckpointName = (cpId: string) => {
  const routes = store.state.dataListRoute || [];
  for (const route of routes) {
    const cp = route.routeDetails?.find(
      (d: { cpId: number | string; cpName?: string }) => String(d.cpId) === String(cpId)
    );
    if (cp) return cp.cpName;
  }
  return t('routes.offline-checkpoint-fallback');
};

onIonViewWillEnter(() => {
  void loadPendingItems();
});

</script>

<style scoped>
.home-content {
  --background: #d1e5e6;
}

.home-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.home-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  -webkit-filter: blur(40px);
  opacity: 0.9;
}

.home-blob-green {
  width: 300px;
  height: 300px;
  background: #e3f7ac;
  top: -10%;
  right: -50px;
}

.home-blob-purple {
  width: 300px;
  height: 300px;
  background: #cac2e9;
  bottom: 1%;
  left: -100px;
}

.dashboard-container {
  position: relative;
  z-index: 1;
  padding: 16px;
  max-width: 720px;
  margin: 0 auto;
}

.profile-card {
  margin-bottom: 24px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(90, 120, 125, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.65);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.profile-card :deep(.profile-card-body) {
  padding: 0;
}

.profile-card :deep(.profile-card-content) {
  padding: 16px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-wrapper {
  position: relative;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(209, 229, 230, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.icon-wrapper-area {
  background: rgba(214, 227, 214, 0.55);
}

.profile-icon {
  font-size: 1.25rem;
  color: #334155;
}

.area-icon {
  color: #dc2626;
}

.status-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #ffffff;
}

.status-dot.online {
  background-color: #10b981;
}

.status-dot.offline {
  background-color: #ef4444;
}

.text-content {
  flex: 1;
  min-width: 0;
}

.user-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.3;
}

.area-name {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: #64748b;
}

.text-code-role {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.user-code {
  font-size: 0.8125rem;
  color: #64748b;
}

.role-tag {
  background: #f3e8ff !important;
  color: #7c3aed !important;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 8px;
}

.profile-divider {
  margin: 16px 0;
}

.menu-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px 12px;
}

@media (min-width: 768px) {
  .menu-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}

.menu-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 12px;
  -webkit-tap-highlight-color: transparent;
}

.menu-tile:hover,
.menu-tile:focus,
.menu-tile:focus-visible,
.menu-tile:active {
  background: transparent;
  outline: none;
  box-shadow: none;
}

.profile-card:hover,
.profile-card :deep(.p-card:hover) {
  box-shadow: 0 4px 20px rgba(90, 120, 125, 0.12);
}

.menu-icon-wrap {
  width: 70px;
  height: 70px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 4px 16px rgba(90, 120, 125, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.menu-icon-wrap:hover {
  box-shadow: 0 4px 16px rgba(90, 120, 125, 0.1);
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(255, 255, 255, 0.75);
}

.menu-icon {
  font-size: 1.75rem;
}

.menu-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #334155;
  line-height: 1.25;
  text-align: center;
}

.tone-orange .menu-icon {
  color: #f97316;
}

.tone-slate .menu-icon {
  color: #475569;
}

.tone-red .menu-icon {
  color: #ef4444;
}

.tone-gold .menu-icon {
  color: #eab308;
}

.tone-blue .menu-icon {
  color: #0ea5e9;
}

.tone-grey .menu-icon {
  color: #62748e;
}

.loading-state {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80%;
  color: #5a6b6d;
  gap: 12px;
}

.loading-state p {
  margin: 0;
  font-size: 0.875rem;
}
</style>
