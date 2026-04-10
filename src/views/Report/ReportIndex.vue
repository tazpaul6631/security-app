<template>
  <ion-page>
    <ion-header>
      <ion-toolbar class="none-padding">
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ $t('page.reports') }}</ion-title>
      </ion-toolbar>
    </ion-header>
  </ion-page>
</template>

<script setup lang="ts">
import router from '@/router';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, useBackButton
} from '@ionic/vue';

useBackButton(10, () => {
  router.replace('/home');
});
</script>

<style scoped></style>