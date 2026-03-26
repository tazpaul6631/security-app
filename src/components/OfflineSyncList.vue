<template>
    <div v-if="displayItems.length > 0" class="ion-margin-top">
        <ion-list-header>
            <ion-label color="primary">{{ $t('areas.report.pending-sync') }} ({{ displayItems.length }})</ion-label>
        </ion-list-header>

        <ion-list lines="full">
            <ion-item-sliding v-for="item in paginatedItems" :key="item.id">
                <ion-item>
                    <ion-thumbnail slot="start" :class="!item.thumb ? 'icon-cloud' : ''">
                        <img v-if="item.thumb" :src="item.thumb" />
                        <ion-icon v-else :icon="cloudOfflineOutline" color="warning" class="icon-cloud"></ion-icon>
                    </ion-thumbnail>
                    <ion-label>
                        <h3>{{ getCheckpointName(item.data?.cpId) }}</h3>
                        <p class="info-offline">
                            <ion-badge class="badge-offline" color="warning">{{ $t('areas.report.offline')
                            }}</ion-badge>
                            {{ formatDate(item.data?.createdAt) }}
                        </p>
                    </ion-label>
                </ion-item>
                <ion-item-options side="end">
                    <ion-item-option color="danger" @click="$emit('delete', item.id)">
                        <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
                    </ion-item-option>
                </ion-item-options>
            </ion-item-sliding>
        </ion-list>

        <ion-infinite-scroll @ionInfinite="onLoadMore" :disabled="loadedCount >= displayItems.length">
            <ion-infinite-scroll-content loading-spinner="bubbles" :loading-text="$t('areas.report.loading-more')">
            </ion-infinite-scroll-content>
        </ion-infinite-scroll>
    </div>
</template>

<script setup lang="ts">
import { IonListHeader, IonLabel, IonList, IonItemSliding, IonItem, IonThumbnail, IonIcon, IonBadge, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/vue';
import { cloudOfflineOutline, trashOutline } from 'ionicons/icons';

const props = defineProps<{
    displayItems: any[];
    paginatedItems: any[];
    loadedCount: number;
    getCheckpointName: Function;
}>();

const emit = defineEmits(['delete', 'loadMore']);

const formatDate = (ts: any) => new Date(ts).toLocaleTimeString();

const onLoadMore = (ev: any) => {
    emit('loadMore', ev);
};
</script>

<style scoped>
.icon-cloud {
    display: flex;
    align-items: center;
    justify-content: center;
}

.info-offline {
    display: flex;
}

.badge-offline {
    margin-right: 4px;
    color: white;
}
</style>