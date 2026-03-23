<template>
    <ion-card>
        <ion-grid>
            <ion-row>
                <ion-col>
                    <ion-card-header class="pad-0">
                        <ion-row>
                            <ion-col>
                                <ion-card-title>{{ dataScanQr.areaName }}</ion-card-title>
                            </ion-col>
                            <ion-col v-if="formattedTime">
                                <span class="timer-display" :class="timerColorClass">
                                    <ion-icon class="icon-clock" :icon="timeOutline"></ion-icon>
                                    Thời gian: {{ formattedTime }}
                                </span>
                            </ion-col>
                        </ion-row>
                        <ion-row>
                            <ion-col>{{ dataScanQr.cpCode }}</ion-col>
                        </ion-row>
                        <ion-row>
                            <ion-col>{{ dataScanQr.cpName }}</ion-col>
                        </ion-row>
                    </ion-card-header>
                </ion-col>
            </ion-row>
            <ion-row v-if="currentActiveRoute">
                <ion-col>
                    <ion-card-subtitle>
                        Mã: {{ currentActiveRoute.routeCode }} | Giờ trực: {{ currentActiveRoute.psHourFrom }}h
                    </ion-card-subtitle>
                </ion-col>
            </ion-row>
            <ion-row v-if="dataScanQr.cpDescription">
                <ion-col>
                    <ion-card-content class="pad-0 ion-padding-top">
                        {{ dataScanQr.cpDescription }}
                    </ion-card-content>
                </ion-col>
            </ion-row>
        </ion-grid>
    </ion-card>
</template>

<script setup lang="ts">
import { IonCard, IonGrid, IonRow, IonCol, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonIcon } from '@ionic/vue';
import { timeOutline } from 'ionicons/icons';

// Nhận dữ liệu từ Component Cha truyền vào
defineProps<{
    dataScanQr: any;
    currentActiveRoute: any;
    formattedTime: string | null;
    timerColorClass: string;
}>();
</script>

<style scoped>
.pad-0 {
    padding: 0;
}

.timer-display {
    display: flex;
    align-items: center;
    margin-top: 5px;
    font-size: 0.9rem;
    font-weight: 500;
    color: #666;
    transition: color 0.3s ease;
}

.icon-clock {
    margin-right: 5px;
    font-size: 1.1rem;
}

.text-success {
    color: var(--ion-color-success, #2dd36f);
}

.text-danger {
    color: var(--ion-color-danger, #eb445a);
    animation: pulse-red 1s infinite;
}

@keyframes pulse-red {
    0% {
        opacity: 1;
    }

    50% {
        opacity: 0.5;
    }

    100% {
        opacity: 1;
    }
}
</style>