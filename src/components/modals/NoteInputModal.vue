<template>
    <ion-modal :is-open="isOpen" @didDismiss="closeModal" class="custom-center-modal">
        <ion-content class="modal-transparent-content">
            <div class="flex-center-container">
                <ion-card class="popup-card">
                    <ion-card-header>
                        <ion-card-title style="font-size: 18px;">Nhập ghi chú chi tiết</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <ion-textarea label="Nội dung" label-placement="floating" fill="outline" v-model="localNote"
                            :rows="4" placeholder="Nhập tại đây...">
                        </ion-textarea>

                        <ion-button expand="block" color="success" class="ion-margin-top" @click="confirm">
                            Xác nhận
                        </ion-button>
                        <ion-button expand="block" fill="clear" color="medium" @click="closeModal">
                            Đóng
                        </ion-button>
                    </ion-card-content>
                </ion-card>
            </div>
        </ion-content>
    </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonModal, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonTextarea, IonButton } from '@ionic/vue';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits(['close', 'confirm']);

const localNote = ref('');

// Xóa trắng ô nhập mỗi khi mở lại modal
watch(() => props.isOpen, (newVal) => {
    if (newVal) localNote.value = '';
});

const closeModal = () => emit('close');

const confirm = () => {
    if (localNote.value.trim()) {
        emit('confirm', localNote.value.trim());
        localNote.value = '';
    }
};
</script>

<style scoped>
/* Copy CSS của Modal từ file cha sang đây */
ion-modal.custom-center-modal {
    --background: transparent;
}

.modal-transparent-content {
    --background: rgba(0, 0, 0, 0.4);
}

.flex-center-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100%;
    padding: 20px;
}

.popup-card {
    width: 100%;
    max-width: 400px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    margin: 0;
}
</style>